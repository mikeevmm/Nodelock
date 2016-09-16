Template.AccountsCreate.events({
  'submit #accounts-create-form':function(event, template){
    var user;

    var username = template.find('#username').value;
    //var email = template.find('#email').value;
    var password = template.find('#password').value;
    var passwordCheck = template.find('#password-check').value;

    check(username, String);
    var username = username.toLowerCase();
    /*if(!isEmailValid(email)){
      Materialize.toast("Ivalid email.", 4000);
      return false;
    }*/
    if(!isUsernameValid(username)){
      Materialize.toast("Invalid username.", 4000);
      return false;
    }

    user = {
      username: username,
      //email :email,
      password: password
    };

    Accounts.createUser(user, function(error){
      if(error){
        Materialize.toast("Could not sign up: " + error.reason, 4000);
        return false;
      }else{
        Materialize.toast("Account created.", 4000);
        FlowRouter.go('dashboard');
        return false;
      }
    });

    return false;
  }
});

var isUsernameValid = function(name){
  return /[\w\d_-]+/i.test(name);
}

var isEmailValid = function(address) {
  return /^[A-Z0-9'.1234z_%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(address);
};
