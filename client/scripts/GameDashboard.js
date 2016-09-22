var marker;
var redMarker;
var redBaseIcon;
var blueBaseIcon;
var nodeIcon;
var blueIcon;
var redIcon;
var game;
var map;
var idToNode;
var latLng;
var nodeIdToMapObjs;
var attackCooldown;
var healCooldown;

Template.GameDashboard.helpers({
  'gameReady':function(){
    return Session.get('gameReady');
  },
  'inNode':function(){
    return !!Session.get('inNode'); // Bang bang, you're a boolean now
  },
  'inBase':function(){
    return Session.get('inBase');
  },
  'inOpponentBase':function(){
    return Session.get('inOpponentBase');
  },
  'team':function(){
    var team = Session.get("team");
    if(!team)
      setTeam();
    return team;
  },
  'perkIcon':function(){
    var perk = Session.get('perk');
    switch (perk) {
      default:
      case "scout":
        return "directions_run";
        break;

      case "medic":
        return "favorite";
        break;

      case "tank":
        return "fitness_center";
        break;
    }
  },
  'isMedic':function(){
    var perk = Session.get('perk');
    return perk == "medic";
  },
  'gameOver':function(){
    return Session.get('gameOver');
  },
  'winner':function(){
    return Session.get('winner');
  },
  'isCreator':function(){
    return Session.get('isCreator');
  }
});

Template.GameDashboard.events({
  'click .set-scout':function(){
    setPerk("scout");
  },
  'click .set-medic':function(){
    setPerk("medic");
  },
  'click .set-tank':function(){
    setPerk("tank");
  },
  'click .get-base-info':function(){
    showBaseHealth();
  },
  'click .get-node-info':function(){
    var currentNode = lodash.find(game.nodes, function(n){ return Session.get('inNode') == n.id; });
    if(!currentNode)
      return;

    Materialize.toast('Node health: ' + currentNode.health, 4000);
  },
  'click .attack':function(){
    var nodeId = Session.get('inNode');
    if(!nodeId)
      return;

    var time;
    if(!attackCooldown){
      attackCooldown = new ReactiveCountdown(ATTACK_COOLDOWN);
      time = 0;
    }else{
      time = attackCooldown.get();
    }

    if(time > 0){
      Materialize.toast("Please wait " + time + " seconds before attacking again.", 4000);
      return;
    }

    Meteor.call('attackNode', nodeId, function(error, result){
      if(error)
        Materialize.toast("An internal error occured.", 4000);
      else if(!result)
        Materialize.toast("An error occured.", 4000);
      else{
        Materialize.toast(result, 4000);
        updateNodeColor();
      }

    });

    attackCooldown.start();
  },
  'click .heal':function(){
    if(Session.get('perk') != "medic"){
      Materialize.toast("Not a medic.", 4000);
      return;
    }

    var nodeId = Session.get('inNode');
    if(!nodeId){
      Materialize.toast("Not in node.", 4000);
      return;
    }

    var time;
    if(!healCooldown){
      healCooldown = new ReactiveCountdown(HEAL_COOLDOWN);
      time = 0;
    }else{
      time = healCooldown.get();
    }

    if(time > 0){
      Materialize.toast("Please wait " + time + " seconds before healing again.", 4000);
      return;
    }

    Meteor.call('healNode', nodeId, function(error, result){
      if(error)
        Materialize.toast("An internal error occured.", 4000);
      else {
        Materialize.toast(result, 4000);
        healCooldown.start();
      }
    });
  },
  'click .attack-opponent':function(){
    if(!Session.get('inOpponentBase')){
      Materialize.toast("Not in base.", 4000);
      return;
    }

    var time;
    if(!attackCooldown){
      attackCooldown = new ReactiveCountdown(ATTACK_COOLDOWN);
      time = 0;
    }else{
      time = attackCooldown.get();
    }

    if(time > 0){
      Materialize.toast("Please wait " + time + " seconds before attacking again.", 4000);
      return;
    }

    Meteor.call('attackOpponent', function(error, result){
      if(error)
        Materialize.toast("An internal error occured.", 4000);
      else {
        if(!result){
          Materialize.toast("An error occured.", 4000);
          return;
        }
        Materialize.toast(result, 4000);
        attackCooldown.start();
      }
    });
  },
  'click .quit-game':function(){
    Meteor.call('quitGame', function(error, result){
      if(error)
        Materialize.toast("An internal error occured.", 4000);
      else
        FlowRouter.go('dashboard');
    });
  },
  'click .cancel-game':function(){
    Meteor.call('cancelGame', function(error, result){
      if(error)
        Materialize.toast("An internal error occured.", 4000);
    });
  }
});

Template.GameDashboard.onRendered(function(){
  var self = this;

  Session.set('nodesSet', false); //DNE! (So it gets reset on refresh)

  self.autorun(function(){
    self.subscribe("Games");
    game = gamesCollection.findOne();

    if(!game)
      return;

    setReady();
    if(!Session.get('gameReady'))
      return;

    latLng = Geolocation.latLng();
    var ready = Session.get('gameReady');
    var mapDiv = $('#map');
    var gameOver = Session.get('gameOver');

    setTeam();
    getPerk();
    createMap();
    createNodeMap();
    setNodes();
    updateNodes();
    updateMap();
    setNodeLines();
    updateNodeColor();
    setGameOver();
    setWinner();
    setIsCreator();
  });
});

var setIsCreator = function(){
  if(!game)
    return

  Session.set('isCreator', false);
  if(game.creator == Meteor.userId())
    Session.set('isCreator', true);
}

var setGameOver = function(){
  Session.set('gameOver', false);
  if(!game || !game.over)
    return;

  Session.set('gameOver', true);
}

var setWinner = function(){
  Session.set('winner', null);
  if(!game || !game.over)
    return;

  Session.set('winner', game.winner);
}

var showBaseHealth = function(){
  if(!game)
    return;

  var team = Session.get('team');

  if(!team)
    setTeam();

  if(team == "blue")
    Materialize.toast("Base health: " + game.bases.firstBase.health, 4000);
  else if(team == "red")
    Materialize.toast("Base health: " + game.bases.secondBase.health, 4000);

}

var setReady = function(){
  if(game.invited.length == 0)
    Session.set('gameReady', true);
  else
    Session.set('gameReady', false);
}

var setTeam = function(){
  var team = Session.get("team");
  if(team || !game)
    return;

  team = (game.red.indexOf(Meteor.userId()) != -1) ? "red" : "blue";
  Session.set("team", team);
}

var getPerk = function(){
  Meteor.call('getPerk', function(error, result){
    if(error)
      Materialize.toast("An internal error occured.", 4000);
    else
      Session.set("perk", result); //Scout is standard
  });
}

var setPerk = function(newPerk){
  var perk = Session.get("perk");
  if(perk == newPerk){
    Materialize.toast("Perk already active.", 4000);
    return;
  }

  Meteor.call('setPerk', newPerk, function(error,result){
    if(error)
      Materialize.toast("An internal error occured.", 4000);
    else{
      if(!result){
        Materialize.toast("Could not change perk.", 4000);
        return;
      }
      Materialize.toast("Perk changed to " + result + ".", 4000);
      Session.set("perk", result);
    }
  });
}

var createMap = function(){
  if(map)
    return;
  try {
    map = L.map('map', {doubleClickZoom: false, touchZoom: true}).setView([0,0], MAP_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    	maxZoom: 19,
    	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
  } catch (e) {
    console.log(e);
  }
}

var createNodeMap = function(){
  if(!game || idToNode)
    return;
  idToNode = {};
  for(var n=0; n<game.nodes.length; n++){
    idToNode[game.nodes[n].id] = game.nodes[n];
  }
  //Add bases too
  idToNode[game.bases.firstBase.id] = game.bases.firstBase;
  idToNode[game.bases.secondBase.id] = game.bases.secondBase;
}

var updateMap = function(){
  var team = Session.get("team");
  if(!game || !team || !L)
    return
  if(!latLng)
    return;

  if(!map)
    return;

  if(!redMarker){
    redMarker = L.icon({
        iconUrl: 'marker-red-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [13, 0],
        shadowUrl: 'node-marker-shadow.png',
        shadowSize: [41, 41],
        shadowAnchor: [15, 41]
    });
  }

  if(!marker){
    if(team == "red")
      marker = L.marker([latLng.lat, latLng.lng], {icon:redMarker}).addTo(map);
    else
      marker = L.marker([latLng.lat, latLng.lng]).addTo(map);
  }else{
    marker.setLatLng(latLng);
  }

  var position = L.latLng(latLng.lat, latLng.lng);
  map.setView(position);
  map.setMaxBounds(L.latLngBounds(position, position));

};

var setNodes = function(){
  var nodesSet = Session.get('nodesSet');
  if(!game || !map || nodesSet) return;

  if(!blueIcon){
    blueIcon = L.icon({
        iconUrl: 'base-blue-marker.png',
        iconSize: [38, 40],
        iconAnchor: [20, 43],
        popupAnchor: [0, -39],
        shadowUrl: 'node-marker-shadow.png',
        shadowSize: [49, 19],
        shadowAnchor: [21, 18]
    });
  }
  if(!redIcon){
    redIcon = L.icon({
        iconUrl: 'base-red-marker.png',
        iconSize: [38, 40],
        iconAnchor: [20, 43],
        popupAnchor: [0, -39],
        shadowUrl: 'node-marker-shadow.png',
        shadowSize: [49, 19],
        shadowAnchor: [21, 18]
    });
  }
  if(!nodeIcon){
    nodeIcon = L.icon({
        iconUrl: 'node-marker.png',
        iconSize: [38, 40],
        iconAnchor: [20, 43],
        popupAnchor: [0, -39],
        shadowUrl: 'node-marker-shadow.png',
        shadowSize: [49, 19],
        shadowAnchor: [21, 18]
    });
  }

  if(!blueBaseIcon){
    blueBaseIcon = L.icon({
        iconUrl: 'big-base-blue-marker.png',
        iconSize: [76, 80],
        iconAnchor: [40, 86],
        popupAnchor: [0, -78],
        shadowUrl: 'big-node-marker-shadow.png',
        shadowSize: [98, 38],
        shadowAnchor: [42, 36]
    });
  }
  if(!redBaseIcon){
    redBaseIcon = L.icon({
        iconUrl: 'big-base-red-marker.png',
        iconSize: [76, 80],
        iconAnchor: [40, 86],
        popupAnchor: [0, -78],
        shadowUrl: 'big-node-marker-shadow.png',
        shadowSize: [98, 38],
        shadowAnchor: [42, 36]
    });
  }

  if(!nodeIdToMapObjs)
    nodeIdToMapObjs = {};

  //Setup bases
  var blueMarker = L.marker([game.bases.firstBase.lat, game.bases.firstBase.lng], {icon:blueBaseIcon}).addTo(map);
  var blueCircle = L.circle([game.bases.firstBase.lat, game.bases.firstBase.lng], MIN_NODE_DISTANCE, {color:BLUE_COLOR, fill:BLUE_FILL}).addTo(map);
  nodeIdToMapObjs[game.bases.firstBase.id] = {maker:blueMarker, circle:blueCircle};
  var redMarker = L.marker([game.bases.secondBase.lat, game.bases.secondBase.lng], {icon:redBaseIcon}).addTo(map);
  var redCircle = L.circle([game.bases.secondBase.lat, game.bases.secondBase.lng], MIN_NODE_DISTANCE, {color:RED_COLOR, fill:RED_FILL}).addTo(map);
  nodeIdToMapObjs[game.bases.secondBase.id] = {marker:redMarker, circle:redCircle};

  //Setup nodes
  nodes = game.nodes;
  for(var n=0; n<nodes.length; n++){
    node = nodes[n];
    //Place markers
    var nodeMarker = L.marker([node.lat,node.lng], {icon:nodeIcon}).addTo(map);
    var nodeCircle = L.circle([node.lat,node.lng], MIN_NODE_DISTANCE, {color:'#2a2a2a', fill:'#bbbbbb'}).addTo(map);

    nodeIdToMapObjs[node.id] = {marker:nodeMarker, circle:nodeCircle};
  }

  Session.set('nodesSet', true);
};

var updateNodeColor = function(){
  for(var n=0; n<game.nodes.length; n++){
    var node = game.nodes[n];
    if(!node.team)
      continue;

    var newIcon;
    var newFill;
    var newColor;

    if(node.team == "blue"){
      newIcon = blueIcon;
      newFill = BLUE_FILL;
      newColor = BLUE_COLOR;
    }else if(node.team == "red"){
      newIcon = redIcon;
      newFill = RED_FILL;
      newColor = RED_COLOR;
    }

    nodeIdToMapObjs[node.id].marker.setIcon(newIcon);
    nodeIdToMapObjs[node.id].circle.setStyle({fill:newFill, color:newColor});
  }
}

var updateNodes = function(){
  var team = Session.get("team");
  var nodesSet = Session.get('nodesSet');
  if(!game || !nodesSet || !team)
    return;
  var nodes = game.nodes;

  if(!latLng)
    return;

  //Is in node?
  Session.set('inNode', null);
  for(var n = 0; n<nodes.length; n++){
    var node = nodes[n];
    var distance = (new L.latLng(node.lat, node.lng)).distanceTo(new L.latLng(latLng.lat, latLng.lng));

    if(distance > MIN_NODE_DISTANCE)
      continue;

    //Inside node!
    Session.set('inNode', node.id);
    break;
  }

  //Is in base?
  Session.set('inBase', false);

  var distance;
  if(team == "blue")
    distance = (new L.latLng(game.bases.firstBase.lat, game.bases.firstBase.lng).distanceTo(new L.latLng(latLng.lat, latLng.lng)));
  else if(team == "red")
    distance = (new L.latLng(game.bases.secondBase.lat, game.bases.secondBase.lng).distanceTo(new L.latLng(latLng.lat, latLng.lng)));

  if(distance <= MIN_NODE_DISTANCE)
    Session.set('inBase', true);

  //Is in opponent base?
  Session.set('inOpponentBase', false);

  var distance;
  if(team == "blue")
    distance = (new L.latLng(game.bases.secondBase.lat, game.bases.secondBase.lng).distanceTo(new L.latLng(latLng.lat, latLng.lng)));
  else if(team == "red")
    distance = (new L.latLng(game.bases.firstBase.lat, game.bases.firstBase.lng).distanceTo(new L.latLng(latLng.lat, latLng.lng)));

  if(distance <= MIN_NODE_DISTANCE)
    Session.set('inOpponentBase', true);
};

var sqr = function(value){
  return value * value;
}

var setNodeLines = function(){
  if(!game)
    return;
  if(!idToNode)
    createNodeMap();
  if(!map)
    createMap();
  if(!map)
    return;

  var nodesWithBases;
  nodesWithBases = game.nodes.slice(0);
  nodesWithBases.push(game.bases.firstBase, game.bases.secondBase);

  for(var n=0;n<nodesWithBases.length;n++){
    var node = nodesWithBases[n];

    for(var i=0; i<node.connectedTo.length; i++){
      var connectToNode = idToNode[node.connectedTo[i]];
      L.polyline([new L.latLng(node.lat,node.lng), new L.latLng(connectToNode.lat, connectToNode.lng)], {color: '#b0b0b0', opacity:0.2, dashArray:"5, 15"}).addTo(map);
    }
  }
}
