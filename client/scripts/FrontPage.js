Template.FrontPageLayout.onCreated(function(){
  Session.set('toggleLogin', true);
});

Template.FrontPageLayout.helpers({
  'toggleLogin':function(){
    return Session.get('toggleLogin');
  }
});

Template.FrontPageLayout.events({
  'click .toggle-login-button':function(){
    Session.set('toggleLogin', !Session.get('toggleLogin'));
  }
});
