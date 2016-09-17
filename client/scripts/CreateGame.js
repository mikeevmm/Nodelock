var marker;
var slider;
var map;
var latLng;

Template.CreateGameLayout.onRendered(function(){
  $('.collapsible').collapsible();

  map = L.map('map', {doubleClickZoom: false, touchZoom: false, dragging:false}).setView([0,0], MAP_ZOOM);
  L.tileLayer('https://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png', {opacity: 0.5}).addTo(map);

  /*slider = noUiSlider.create(document.getElementById("slider"), {
    connect: "lower",
    range: {
      min: 5,
      max: 60
    },
    start: 5,
    step: 5,
    format: wNumb({
  		decimals: 0
  	})
  });
  slider.on('update', function( values, handle ) {
  	Session.set('sliderValue', values[handle]);
  });*/

  updateMap();
});

Template.CreateGameLayout.onCreated(function(){
  Session.set('players', []);
  Session.set('nodeCoords', []);
  Session.set('submited', false);

  var self = this;

  self.autorun(function(){
    latLng = Geolocation.latLng();
    updateMap();
  });
});

var updateMap = function(){
  if(!latLng || !map)
    return;
  if(!marker){
    nodeIcon = L.icon({
        iconUrl: 'node-marker.png',
        iconSize: [38, 40],
        iconAnchor: [20, 43],
        popupAnchor: [0, -39],
        shadowUrl: 'node-marker-shadow.png',
        shadowSize: [49, 19],
        shadowAnchor: [21, 18]
    });
    marker = L.marker([latLng.lat, latLng.lng]).addTo(map);
  }else{
    marker.setLatLng(latLng);
  }
  map.setView(marker.getLatLng());
  map.setZoom(MAP_ZOOM);
}

Template.CreateGameLayout.helpers({
  'user':function(){
    return Meteor.user().username;
  },
  'players': function(){
    return Session.get('players');
  },
  'geoFixed':function(){
    return Geolocation.latLng() != null;
  },
  'gameTime':function(){
    return Session.get('sliderValue');
  }
});

Template.CreateGameLayout.events({
  'click .collapsible li':function(){
    map.invalidateSize();
  },
  'click #add-node-btn':function(){
    if(Geolocation.latLng() == null){
      Materialize.toast("No location signal!", 4000);
      return;
    }
    var e = marker.getLatLng();
    var existingNodes = Session.get('nodeCoords');

    if( lodash.findIndex(existingNodes, e) != -1){
      Materialize.toast("Node already exists.", 4000);
      return;
    }

    //Check if too close
    for(var n=0; n<existingNodes.length; n++){
      var node=existingNodes[n];
      var nodeA = L.latLng(node.lat, node.lng);
      var nodeB = L.latLng(e.lat, e.lng);
      if(nodeA.distanceTo(nodeB) < MIN_NODE_DISTANCE){
        Materialize.toast("Node is too close to another node. (Min. "+MIN_NODE_DISTANCE+"m)", 4000);
        return false;
      }
    }

    existingNodes.push(e);
    Session.set('nodeCoords', existingNodes);
    var nodeMarker = L.marker([e.lat, e.lng], {icon:nodeIcon});
    nodeMarker.addTo(map);
    nodeMarker.on('click', function(e){
      Session.set('nodeCoords', lodash.filter(Session.get('nodeCoords'), e.target));
      map.removeLayer(e.target);
    });
    Materialize.toast("Added node. Tap to remove.", 4000);
  },
  'click .remove-player':function(event, template){
    var userToRemove = $(event.target).attr('remove');
    var prevPlayers = Session.get('players');
    Session.set('players', _.without(prevPlayers, userToRemove));
  },
  'submit #add-player':function(event, template){
    var usernameField = template.find('#new-player-username');
    var newPlayerUsername = usernameField.value;

    var throwErr = function(error){
      Materialize.toast(error, 4000);
      usernameField.value = "";
      return false;
    }

    var userAlreadyInvited = function(user){
      return Session.get('players').indexOf(user) != -1;
    }

    if (userAlreadyInvited(newPlayerUsername) == true){
      return throwErr("Already invited.");
    }

    if(newPlayerUsername === Meteor.user().username){
      return throwErr("You can't invite yourself.");
    }

    Meteor.call('checkIfUsername', newPlayerUsername, function(error,result){
      if(error){
        Materialize.toast("An internal error occured.", 4000);
      }else{
        addUser(result);
      }
    });

    var addUser = function(userExists){
      if(!userExists){
        return throwErr("No such user.");
      }

      var currentParticipants = Session.get('players');
      currentParticipants.push(newPlayerUsername);
      Session.set('players', currentParticipants);
      usernameField.value = "";
      return true;
    };

    return false;
  },
  'click #create-game-btn': function(event, template) {
    if(Session.get('submited')){
      Materialize.toast("Already submited.", 4000);
      return false;
    }

    var newGame;
    var players = Session.get('players');
    var nodes = Session.get('nodeCoords');
    var time = Session.get('sliderValue');

    if(players.length < 1){
      Materialize.toast("Please add at least another player.", 4000);
      return false;
    }
    if(nodes.length < 5){
      Materialize.toast("Please add at least five nodes.", 4000);
      return false;
    }
    for(var n=0; n<nodes.length; n++){
      var node = nodes[n];
      var nodeA = L.latLng(node.lat, node.lng);
      for(var i=(n+1); i<nodes.length; i++){
        var otherNode = nodes[i];
        var nodeB = L.latLng(otherNode.lat, otherNode.lng);
        if(nodeA.distanceTo(nodeB) < MIN_NODE_DISTANCE){
          Materialize.toast("Invalid nodes.", 4000);
          return false;
        }
      }
    }

    newGame = {players: players,
              nodes:nodes,
              //time: time
            };

    Meteor.call('validateAndCreateGame', newGame, function(error, result){
      if(error){
        Materialize.toast("An internal error occured.", 4000);
      }else{
        if(!result)
          Materialize.toast("An error occured.", 4000);
        else {
          Session.set('submited', true);
          FlowRouter.go('game');
        }
      }
    });

    return false;
  }
});
