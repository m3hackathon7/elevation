angular.module('starter.route', [])

.controller('RouteCtrl', function($scope, $log, Routes) {
  var self = this;

  self.search = function() {
    Routes.search(self.from, self.to)
      .then(function(route) {
        $log.debug(route);
        self.route = route;
      });
  };

  self.hasRoute = function() {
    return !!self.route;
  };
})

.factory('Routes', function($http) {
  var url = 'http://maps.googleapis.com/maps/api/directions/json';

  function search(from, to) {
    var params = {
      origin: from,
      destination: to,
      sensor: false
    };
    return $http.get(url, { params: params })
      .then(function(response) {
        return response.data.routes[0];
      });
  }

  return {
    search: search
  };
})

.filter('latlng', function(numberFilter) {
  return function(latlng) {
    var lat = numberFilter(latlng.lat, 4);
    var lng = numberFilter(latlng.lng, 4);
    return ['(', lat, ',', lng, ')'].join('')
  };
})

.directive('googleMap', function() {
  return {
    restrict: 'E',
    link: function(scope, element, attrs) {
      var latlng = new google.maps.LatLng(35.6808, 139.7669);
      var options = {
        zoom: 14,
        center: latlng,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      };
      var map = new google.maps.Map(element[0], options);
      var marker = new google.maps.Marker({ position: latlng, map: map });
    }
  };
});
