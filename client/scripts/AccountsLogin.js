Template.AccountsLogin.events({
  'submit #loginForm':function(event, template){
    var username = template.find('#username').value;
    var password = template.find('#password').value;
    Meteor.loginWithPassword(username, password, function(error){
      if(Meteor.userId()){
        FlowRouter.go('dashboard');
      }else{
        console.log(error.reason);
        Materialize.toast(error.reason, 4000);
      }
      return false;
    });
    return false;
  }
});
