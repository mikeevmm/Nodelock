Template.JoinGame.onCreated(function(){
  var self = this;
  self.autorun(function(){
    self.subscribe("Invitations");
  });
});

Template.JoinGame.helpers({
  'invitations':function(){
    return gamesCollection.find({});
  },
  'inviting':function(){
    return this.creatorUsername;
  },
  'gameid':function(){
    return this._id;
  },
  'redFull':function(){
    var totalNumberOfPlayers = this.invited.length + this.players.length;
    var numberRedPlayers = this.red.length;
    var maxNumberPlayers = totalNumberOfPlayers - Math.round(totalNumberOfPlayers/2);
    if(numberRedPlayers >= maxNumberPlayers){
      return "disabled";
    }
    return "enabled";
  },
  'blueFull':function(){
    var totalNumberOfPlayers = this.invited.length + this.players.length;
    var numberBluePlayers = this.blue.length;
    var maxNumberPlayers = Math.round(totalNumberOfPlayers/2);
    if(numberBluePlayers >= maxNumberPlayers){
      return "disabled";
    }
    return "enabled";
  }
});

Template.JoinGame.events({
  'click .join':function(event, template){
    var button = event.target;
    var inviting = $(button).attr('inviting'); //Not currently using
    var gameId = $(button).attr('gameid');
    var team = $(button).attr('team');
    var disabled = $(button).attr('isDisabled');

    if((disabled == "disabled") ? true : false)
      return false;

    Meteor.call('enterGame', gameId, team, function(error, result){
      if(error)
        Materialize.toast("An internal error occured. Try again later.");
      else {
        if(!result)
          Materialize.toast('An error occured.')
        else
          FlowRouter.go('game');
      }
    });
  }
});
