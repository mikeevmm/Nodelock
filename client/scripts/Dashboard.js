Template.DashboardLayout.helpers({
  user:function(){
    return Meteor.user().username;
  }
});

Template.DashboardLayout.onCreated(function(){
  var self = this;
  self.autorun(function(){
    self.subscribe("Games", function(){
      if(gamesCollection.findOne({players:Meteor.userId()})){
        FlowRouter.go('game');
      }
    });
  });
});
