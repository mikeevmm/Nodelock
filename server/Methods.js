Meteor.methods({
  checkIfUsername:function(username){
    check(username, String);
    return (Meteor.users.find({username:username}).count() > 0);
  },
  validateAndCreateGame:function(newGame){
    check(newGame, {players:[String], nodes:[Object]});
    var nodes = newGame.nodes;
    //var time = parseInt(newGame.time);
    var creatorId = Meteor.userId();
    var creatorUser = Meteor.users.findOne({_id:creatorId}).username;

    //Extra safety checks
    if(newGame.players.length < 1) //Excluding creator
      return false;
    if(newGame.nodes.length < 5)
      return false;
    //if(time < 5 || time > 60 || time%5 != 0)
    //  return false;
    console.log("Safety checks complete.");

    var players = [];
    //Parse players; get id from usernames
    for(var n=0; n<newGame.players.length; n++){
      var playerId = Meteor.users.findOne({username: newGame.players[n]})._id;
      if(playerId == null)
        return false;
      players.push(playerId);
    }
    console.log("Players added");

    //Get bounding box and array'd latLngs in one pass
    var TRIANG_FACTOR = 1E8; //To use integers in points

    var minLngNode;
    var maxLngNode
    var minLatNode;
    var maxLatNode;

    var secondMinLngNode;
    var secondMaxLngNode;
    var secondMinLatNode;
    var secondMaxLatNode;

    var nodeMap = {}; //Maps lat lng to node
    var delaunayPoints = [];

    for(var n=0; n<nodes.length; n++){
      var currentNode = nodes[n];
      check(currentNode, {lat:Number, lng:Number});

      //Fix decimals to 8 to avoid weird .9999999 issues
      currentNode.lat = currentNode.lat.toFixed(8);
      currentNode.lng = currentNode.lng.toFixed(8);

      //Delaunay stuff
      var delaunayPoint = [currentNode.lng * TRIANG_FACTOR, currentNode.lat * TRIANG_FACTOR];
      //Array for Delaunay
      delaunayPoints.push(delaunayPoint);
      //Map from [lng, lat] to node
      nodeMap[delaunayPoint] = currentNode;

      //Add IDs to nodes
      currentNode.id = Math.random();

      //Init connectedTo param
      currentNode.connectedTo = [];

      //Init health param
      currentNode.health = NEUTRAL_NODE_HEALTH;

      //Bounding box
      if(minLngNode == null || currentNode.lng < minLngNode.lng)
        minLngNode = currentNode;
      if(maxLngNode == null || currentNode.lng > maxLngNode.lng)
        maxLngNode = currentNode;
      if(minLatNode == null || currentNode.lat < minLatNode.lat)
        minLatNode = currentNode;
      if(maxLatNode == null || currentNode.lat > maxLngNode.lat)
        maxLatNode = currentNode;
    }

    //Check shape of bounding box and select two nodes for base
    var firstBaseNode;
    var secondBaseNode;
    var horizSize = maxLngNode.lng - minLngNode.lng;
    var vertSize = maxLatNode.lat - minLatNode.lat;

    if(horizSize > vertSize){
      firstBaseNode = minLngNode;
      secondBaseNode = maxLngNode;
    }else{
      firstBaseNode = minLatNode;
      secondBaseNode = maxLatNode;
    }

    //Remove bases from nodes array
    nodes.splice(nodes.indexOf(firstBaseNode), 1);
    nodes.splice(nodes.indexOf(secondBaseNode), 1);

    //Set bases life
    var totalNumberOfPlayers = players.length + 1; //Invited players + creator
    var blueMaxPlayers = Math.round(totalNumberOfPlayers / 2);
    var redMaxPlayers = totalNumberOfPlayers - blueMaxPlayers;
    //Base health = number of opponents * const
    //First base -> blue
    //Second base -> red
    firstBaseNode.health = redMaxPlayers * BASE_HEALTH_MULTIPLY_CONST;
    secondBaseNode.health = blueMaxPlayers * BASE_HEALTH_MULTIPLY_CONST;

    //Bases object
    var bases = {firstBase:firstBaseNode,
                secondBase:secondBaseNode};

    //Triangulate nodes
    //Delaunay up in this
    var triangles = Delaunay.triangulate(delaunayPoints);
    //Go through triplets, get nodes, connect
    for(var n=0; n<triangles.length; n+=3){
      var nodeA = nodeMap[delaunayPoints[triangles[n]]];
      var nodeB = nodeMap[delaunayPoints[triangles[n+1]]];
      var nodeC = nodeMap[delaunayPoints[triangles[n+2]]];

      var checkIfDuplicateAndAdd = function(A, B){
        if(A.connectedTo.indexOf(B.id) == -1)
          A.connectedTo.push(B.id);
        if(B.connectedTo.indexOf(A.id) == -1)
          B.connectedTo.push(A.id);
      };

      checkIfDuplicateAndAdd(nodeA, nodeB);
      checkIfDuplicateAndAdd(nodeA, nodeC);
      checkIfDuplicateAndAdd(nodeB, nodeA);
      checkIfDuplicateAndAdd(nodeB, nodeC);
      checkIfDuplicateAndAdd(nodeC, nodeB);
      checkIfDuplicateAndAdd(nodeC, nodeB);
    }


    //Verified game object
    var verifiedGame = {players:[creatorId], invited: players, bases:bases, nodes:nodes, creator:creatorId, creatorUsername:creatorUser, blue:[creatorId], red:[]};

    //Check if game already exists
    if(gamesCollection.findOne(verifiedGame))
      return false;
    console.log("No identical games found");

    gamesCollection.insert(verifiedGame);
    return true;
  },
  enterGame:function(gameId, team){
    check(gameId, String);
    check(team, String);
    if(team != "blue" && team != "red")
      return false;

    var userId = this.userId;
    gamesCollection.update({_id:gameId}, {$pull:{invited:userId}, $push:{players:userId}});
    if(team == "blue")
      gamesCollection.update({_id:gameId}, {$push:{blue:userId}});
    else if(team == "red")
      gamesCollection.update({_id:gameId}, {$push:{red:userId}});
    return true;
  },
  'getPerk':function(){
    var game = gamesCollection.findOne({players:this.userId});
    var gameId = game._id;

    if(game.scout && game.scout.indexOf(this.userId) != -1)
      return "scout";
    if(game.medic && game.medic.indexOf(this.userId) != -1)
      return "medic";
    if(game.tank && game.tank.indexOf(this.userId) != -1)
      return "tank";

    //Either the player isn't any of these, or they're all null
    gamesCollection.update({_id:gameId}, {$push:{scout:this.userId}});
    return "scout";

    //Something went wrong
    return null;
  },
  'setPerk':function(perk){
    check(perk, String);

    var game = gamesCollection.findOne({players:this.userId});
    var gameId = game._id;
    var playerId = this.userId;

    switch(perk){
      case "scout":
        gamesCollection.update({_id:gameId}, { $pull:{medic:playerId, tank:playerId}, $push:{scout:playerId} });
        break;
      case "medic":
        gamesCollection.update({_id:gameId}, { $pull:{scout:playerId, tank:playerId}, $push:{medic:playerId} });
        break;
      case "tank":
        gamesCollection.update({_id:gameId}, { $pull:{scout:playerId, medic:playerId}, $push:{tank:playerId} });
        break;
      default:
        return null;
    }

    return perk;
  },
  'attackNode':function(nodeId){
    check(nodeId, Number);

    var game = gamesCollection.findOne({players:this.userId});
    var gameId = game._id;
    var node = lodash.find(game.nodes,{id:nodeId});

    if(!node || !game)
      return null;

    //Determine player perk
    var perk = "scout";
    if(game.medic && game.medic.indexOf(this.userId) != -1)
      perk = "medic";
    if(game.tank && game.tank.indexOf(this.userId) != -1)
      perk = "tank";

    //Determine player damage
    //Determine player node capture base life
    var damage;
    var baseLife;

    switch(perk){
      case "scout":
        damage = SCOUT_DAMAGE;
        baseLife = SCOUT_CAPTURE_LIFE;
        break;
      case "medic":
        damage = MEDIC_DAMAGE;
        baseLife = MEDIC_CAPTURE_LIFE;
        break;
      case "tank":
        damage = TANK_DAMAGE;
        baseLife = MEDIC_CAPTURE_LIFE;
        break;
      default:
        return null;
    }

    //Determine player team
    var team;
    if(game.blue.indexOf(this.userId) != -1)
      team = "blue";
    if(game.red.indexOf(this.userId) != -1)
      team = "red";

    if(!team)
      return null;

    if(damage == 0)
      return "You cannot deal damage.";

    //Check if node is connected to team Node
    var connectedToTeam = false;
    if(team == "blue" && node.connectedTo.indexOf(game.bases.firstBase.id) != -1)
      connectedToTeam = true;
    if(team == "red" && node.connectedTo.indexOf(game.bases.secondBase.id) != -1)
      connectedToTeam = true;

    for(var n=0; n<node.connectedTo.length; n++){
      if(connectedToTeam)
        break;

      var connectedToId = node.connectedTo[n];
      var connectedToNode = lodash.find(game.nodes, {id:connectedToId});

      //Opponent base might be connected -> connectedToNode is null
      if(connectedToNode && connectedToNode.team && connectedToNode.team == team){
        connectedToTeam = true;
        break;
      }
    }

    if(!connectedToTeam)
      return "Node is not connected to team node.";

    if(node.team && team == node.team)
      return "You cannot attack your team's node."

    if(node.health - damage <= 0){
      gamesCollection.update({_id:gameId, "nodes.id":nodeId}, {$set:{"nodes.$.health":baseLife, "nodes.$.team":team}});
      return "Node captured."
    }else{
      gamesCollection.update({_id:gameId, "nodes.id":nodeId}, {$set:{"nodes.$.health":(node.health - damage)}});
      return "Attack successful. Node health: " + (node.health - damage);
    }

    return null;
  },
  'healNode':function(nodeId){
    check(nodeId, Number);

    var game = gamesCollection.findOne({players:this.userId});
    var oldHealth = lodash.find(game.nodes, {id:nodeId}).health;
    gamesCollection.update({_id:game._id, "nodes.id":nodeId}, {$set:{"nodes.$.health":(oldHealth + MEDIC_HEAL)}});

    return "Node healed. Current node health: " + (oldHealth + MEDIC_HEAL);
  },
  'attackOpponent':function(){
    var game = gamesCollection.findOne({players:this.userId});

    //Determine opposing team base
    var team;
    var teamBase;
    var opposingBase;
    var opposingTeamBase;
    var opposingTeamHealth;
    if(game.blue.indexOf(this.userId) != -1){ //is blue
      team = "blue";
      teamBase = game.bases.firstBase;
      opposingBase = game.bases.secondBase;
      opposingTeamBase = "secondBase"; //red base
      opposingTeamHealth = game.bases.secondBase.health;
    }else if(game.red.indexOf(this.userId) != -1){ //Is red
      team = "red";
      teamBase = game.bases.secondBase;
      opposingBase = game.bases.firstBase;
      opposingTeamBase = "firstBase"; //blue base
      opposingTeamHealth = game.bases.firstBase.health;
    }

    //Determine if opposing base is connected to team node
    var connected = false;
    if(opposingBase.connectedTo.indexOf(teamBase.id) != -1)
      connected = true;
    for(var n=0; n<opposingBase.connectedTo.length; n++){
      if(connected)
        break;

      var node = lodash.find(game.nodes, {id:opposingBase.connectedTo[n]});
      if(node && node.team && node.team == team)
        connected = true;
    }

    if(!connected)
      return "Not connected to team's node.";

    //Determine player perk
    var perk = "scout";
    if(game.medic && game.medic.indexOf(this.userId) != -1)
      perk = "medic";
    if(game.tank && game.tank.indexOf(this.userId) != -1)
      perk = "tank";

    //Determine damage
    var damage;
    switch(perk){
      case "scout":
        damage = SCOUT_DAMAGE;
        break;
      case "medic":
        damage = MEDIC_DAMAGE;
        break;
      case "tank":
        damage = TANK_DAMAGE;
        break;
      default:
        return null;
    }

    if(damage == 0)
      return "You cannot deal damage.";

    if(opposingTeamHealth - damage <= 0){
      gamesCollection.update({_id:game._id}, {$set:{over:true, winner:team}});
      return "Base captured. Victory!";
    }else{
      if(opposingTeamBase == "firstBase")
        gamesCollection.update({_id:game._id}, {$set:{ "bases.firstBase.health":(opposingTeamHealth - damage) }});
      else if(opposingTeamBase == "secondBase")
        gamesCollection.update({_id:game._id}, {$set:{ "bases.secondBase.health":(opposingTeamHealth - damage) }});

      return "Attack successful. Opponent base health: " + (opposingTeamHealth - damage);
    }
  },
  'quitGame':function(){
    var playerId = this.userId;
    var gameId = gamesCollection.findOne({players:playerId})._id;
    gamesCollection.update({players:playerId}, {$pull:{players:playerId}});

    if(gamesCollection.findOne({_id:gameId}).players.length == 0)
      gamesCollection.remove({_id:gameId});
  }
});



var Delaunay;

//Delaunay library
(function() {
  "use strict";

  var EPSILON = 1.0 / 1048576.0;

  function supertriangle(vertices) {
    var xmin = Number.POSITIVE_INFINITY,
        ymin = Number.POSITIVE_INFINITY,
        xmax = Number.NEGATIVE_INFINITY,
        ymax = Number.NEGATIVE_INFINITY,
        i, dx, dy, dmax, xmid, ymid;

    for(i = vertices.length; i--; ) {
      if(vertices[i][0] < xmin) xmin = vertices[i][0];
      if(vertices[i][0] > xmax) xmax = vertices[i][0];
      if(vertices[i][1] < ymin) ymin = vertices[i][1];
      if(vertices[i][1] > ymax) ymax = vertices[i][1];
    }

    dx = xmax - xmin;
    dy = ymax - ymin;
    dmax = Math.max(dx, dy);
    xmid = xmin + dx * 0.5;
    ymid = ymin + dy * 0.5;

    return [
      [xmid - 20 * dmax, ymid -      dmax],
      [xmid            , ymid + 20 * dmax],
      [xmid + 20 * dmax, ymid -      dmax]
    ];
  }

  function circumcircle(vertices, i, j, k) {
    var x1 = vertices[i][0],
        y1 = vertices[i][1],
        x2 = vertices[j][0],
        y2 = vertices[j][1],
        x3 = vertices[k][0],
        y3 = vertices[k][1],
        fabsy1y2 = Math.abs(y1 - y2),
        fabsy2y3 = Math.abs(y2 - y3),
        xc, yc, m1, m2, mx1, mx2, my1, my2, dx, dy;

    /* Check for coincident points */
    if(fabsy1y2 < EPSILON && fabsy2y3 < EPSILON)
      throw new Error("Eek! Coincident points!");

    if(fabsy1y2 < EPSILON) {
      m2  = -((x3 - x2) / (y3 - y2));
      mx2 = (x2 + x3) / 2.0;
      my2 = (y2 + y3) / 2.0;
      xc  = (x2 + x1) / 2.0;
      yc  = m2 * (xc - mx2) + my2;
    }

    else if(fabsy2y3 < EPSILON) {
      m1  = -((x2 - x1) / (y2 - y1));
      mx1 = (x1 + x2) / 2.0;
      my1 = (y1 + y2) / 2.0;
      xc  = (x3 + x2) / 2.0;
      yc  = m1 * (xc - mx1) + my1;
    }

    else {
      m1  = -((x2 - x1) / (y2 - y1));
      m2  = -((x3 - x2) / (y3 - y2));
      mx1 = (x1 + x2) / 2.0;
      mx2 = (x2 + x3) / 2.0;
      my1 = (y1 + y2) / 2.0;
      my2 = (y2 + y3) / 2.0;
      xc  = (m1 * mx1 - m2 * mx2 + my2 - my1) / (m1 - m2);
      yc  = (fabsy1y2 > fabsy2y3) ?
        m1 * (xc - mx1) + my1 :
        m2 * (xc - mx2) + my2;
    }

    dx = x2 - xc;
    dy = y2 - yc;
    return {i: i, j: j, k: k, x: xc, y: yc, r: dx * dx + dy * dy};
  }

  function dedup(edges) {
    var i, j, a, b, m, n;

    for(j = edges.length; j; ) {
      b = edges[--j];
      a = edges[--j];

      for(i = j; i; ) {
        n = edges[--i];
        m = edges[--i];

        if((a === m && b === n) || (a === n && b === m)) {
          edges.splice(j, 2);
          edges.splice(i, 2);
          break;
        }
      }
    }
  }

  Delaunay = {
    triangulate: function(vertices, key) {
      var n = vertices.length,
          i, j, indices, st, open, closed, edges, dx, dy, a, b, c;

      /* Bail if there aren't enough vertices to form any triangles. */
      if(n < 3)
        return [];

      /* Slice out the actual vertices from the passed objects. (Duplicate the
       * array even if we don't, though, since we need to make a supertriangle
       * later on!) */
      vertices = vertices.slice(0);

      if(key)
        for(i = n; i--; )
          vertices[i] = vertices[i][key];

      /* Make an array of indices into the vertex array, sorted by the
       * vertices' x-position. */
      indices = new Array(n);

      for(i = n; i--; )
        indices[i] = i;

      indices.sort(function(i, j) {
        return vertices[j][0] - vertices[i][0];
      });

      /* Next, find the vertices of the supertriangle (which contains all other
       * triangles), and append them onto the end of a (copy of) the vertex
       * array. */
      st = supertriangle(vertices);
      vertices.push(st[0], st[1], st[2]);

      /* Initialize the open list (containing the supertriangle and nothing
       * else) and the closed list (which is empty since we havn't processed
       * any triangles yet). */
      open   = [circumcircle(vertices, n + 0, n + 1, n + 2)];
      closed = [];
      edges  = [];

      /* Incrementally add each vertex to the mesh. */
      for(i = indices.length; i--; edges.length = 0) {
        c = indices[i];

        /* For each open triangle, check to see if the current point is
         * inside it's circumcircle. If it is, remove the triangle and add
         * it's edges to an edge list. */
        for(j = open.length; j--; ) {
          /* If this point is to the right of this triangle's circumcircle,
           * then this triangle should never get checked again. Remove it
           * from the open list, add it to the closed list, and skip. */
          dx = vertices[c][0] - open[j].x;
          if(dx > 0.0 && dx * dx > open[j].r) {
            closed.push(open[j]);
            open.splice(j, 1);
            continue;
          }

          /* If we're outside the circumcircle, skip this triangle. */
          dy = vertices[c][1] - open[j].y;
          if(dx * dx + dy * dy - open[j].r > EPSILON)
            continue;

          /* Remove the triangle and add it's edges to the edge list. */
          edges.push(
            open[j].i, open[j].j,
            open[j].j, open[j].k,
            open[j].k, open[j].i
          );
          open.splice(j, 1);
        }

        /* Remove any doubled edges. */
        dedup(edges);

        /* Add a new triangle for each edge. */
        for(j = edges.length; j; ) {
          b = edges[--j];
          a = edges[--j];
          open.push(circumcircle(vertices, a, b, c));
        }
      }

      /* Copy any remaining open triangles to the closed list, and then
       * remove any triangles that share a vertex with the supertriangle,
       * building a list of triplets that represent triangles. */
      for(i = open.length; i--; )
        closed.push(open[i]);
      open.length = 0;

      for(i = closed.length; i--; )
        if(closed[i].i < n && closed[i].j < n && closed[i].k < n)
          open.push(closed[i].i, closed[i].j, closed[i].k);

      /* Yay, we're done! */
      return open;
    },
    contains: function(tri, p) {
      /* Bounding box test first, for quick rejections. */
      if((p[0] < tri[0][0] && p[0] < tri[1][0] && p[0] < tri[2][0]) ||
         (p[0] > tri[0][0] && p[0] > tri[1][0] && p[0] > tri[2][0]) ||
         (p[1] < tri[0][1] && p[1] < tri[1][1] && p[1] < tri[2][1]) ||
         (p[1] > tri[0][1] && p[1] > tri[1][1] && p[1] > tri[2][1]))
        return null;

      var a = tri[1][0] - tri[0][0],
          b = tri[2][0] - tri[0][0],
          c = tri[1][1] - tri[0][1],
          d = tri[2][1] - tri[0][1],
          i = a * d - b * c;

      /* Degenerate tri. */
      if(i === 0.0)
        return null;

      var u = (d * (p[0] - tri[0][0]) - b * (p[1] - tri[0][1])) / i,
          v = (a * (p[1] - tri[0][1]) - c * (p[0] - tri[0][0])) / i;

      /* If we're outside the tri, fail. */
      if(u < 0.0 || v < 0.0 || (u + v) > 1.0)
        return null;

      return [u, v];
    }
  };

  if(typeof module !== "undefined")
    module.exports = Delaunay;
})();
