MAP_ZOOM = 18;
BOUNDS_WIDTH = 0.0003;

// Auto redirect to https
// (Chrome only allows for geolocation on https)
Template.onRendered(function(){
    if (window.location.protocol != "https:")
        window.location.href = "https:" + window.location.href.substring(window.location.protocol.length);
});