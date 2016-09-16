Template.SideBar.rendered = function(){
  $(".button-collapse").sideNav({
    closeOnClick: false
  });
};

Template.SideBar.events({
  'click .button-collapse':function(){
    $('.button-collapse').sideNav('show');
  },
  'click a.logout':function(){
    Meteor.logout(function(){
      FlowRouter.go('home');
    });
  }
});
