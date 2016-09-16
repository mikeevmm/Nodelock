Meteor.publish('Games', function(){
  return gamesCollection.find({players: this.userId});
});

Meteor.publish('Invitations', function(){
  return gamesCollection.find({invited:this.userId}, {fields:{players:1, invited:1, blue:1, red:1, creatorUsername:1}});
});
