Template.logout.events({
  'click .logout-buttons-container':function(){
    Meteor.logout(function(error){
      FlowRouter.go('home');
    });
  }
});
