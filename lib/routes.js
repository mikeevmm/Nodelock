FlowRouter.triggers.enter([
  function(context, redirect){
    if(!Meteor.userId()){
      FlowRouter.go('home');
    }
  }
]);

FlowRouter.notFound = {
  action(){
    FlowRouter.go('404');
  }
};

FlowRouter.route('/404', {
  name:'404',
  action(){
    BlazeLayout.render('NotFound');
  }
});

FlowRouter.route('/', {
  name:'home',
  action() {
    if(Meteor.userId()){
      FlowRouter.go('dashboard');
    }
    BlazeLayout.render('FrontPageLayout');
  }
});

FlowRouter.route('/dashboard', {
  name: 'dashboard',
  action (){
    BlazeLayout.render('DashboardLayout');
  }
});

FlowRouter.route('/create', {
  name:'create',
  action(){
    BlazeLayout.render('CreateGameLayout');
  }
});

FlowRouter.route('/join', {
  name:'join',
  action() {
    BlazeLayout.render('JoinGame');
  }
});

FlowRouter.route('/game', {
  name: 'game',
  action(){
    BlazeLayout.render('GameDashboard');
  }
})
