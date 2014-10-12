angular.module('starter.route', [])

.controller('RouteCtrl', function($scope,
                                  $log,
                                  $ionicPopup,
                                  $cordovaGeolocation,
                                  Routes) {
  var self = this;

  self.search = function() {
    Routes.search(self.from, self.to)
      .then(function(route) {
        $log.debug(route);
        self.route = route;
      }, function(error) {
        $log.error('Failed to search route:', error);
        $ionicPopup.alert({
          title: 'Error',
          template: 'Failed to search route.'
        });
        self.route = null;
      });
  };

  self.hasRoute = function() {
    return !!self.route;
  };

  self.showSearchPopup = function() {
    $ionicPopup.show({
      templateUrl: 'templates/route-search-popup.html',
      title: 'Search',
      scope: $scope,
      buttons: [
        { text: 'Cancel' },
        {
          text: 'Search',
          type: 'button-positive',
          onTap: function() {
            self.search();
          }
        }
      ]
    });
  };

  $cordovaGeolocation.getCurrentPosition()
    .then(function(position) {
      $log.debug('current location', position);
      self.currentPosition = position;
    }, function(error) {
      $log.error(error);
      $ionicPopup.alert({
        title: 'Error',
        template: error.toString()
      });
      self.currentPosition = null;
    });
})

.factory('Routes', function($http) {
  var url = 'http://maps.googleapis.com/maps/api/directions/json';
  // API proxy for browser testing.
  if (!window.cordova) {
    url = 'http://localhost:3333/routes';
  }

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

.directive('evGoogleMap', function($log) {
  return {
    restrict: 'E',
    scope: {
      center: '=',
      route: '='
    },
    link: function(scope, element, attrs) {
      var overlays = [];

      var map = new google.maps.Map(element[0], {
        center: new google.maps.LatLng(35.6808, 139.7669), // Center of Tokyo
        zoom: 14,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      });

      scope.$watch('center', function() {
        if (scope.center) {
          moveMap(scope.center);
        }
      });
      scope.$watch('route', function() {
        if (scope.route && scope.route.legs) {
          showRoute(scope.route);
        }
      });

      function moveMap(position) {
        var latlng = positionToLatLng(position);
        map.panTo(latlng);
        addMarker(latlng);
      }

      function showRoute(route) {
        $log.debug(route);
        var polyline = createRoutePolyline(route);
        addOverlay(polyline);

        var bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(route.bounds.southwest),
          new google.maps.LatLng(route.bounds.northeast)
        );
        map.panToBounds(bounds);
      }

      function addMarker(latlng) {
        var marker = new google.maps.Marker({
          position: latlng
        });
        addOverlay(marker);
      }

      function addOverlay(overlay) {
        overlay.setMap(map);
        overlays.push(overlay);
      }

      function clearOverlays() {
        overlays.forEach(function(overlay) {
          overlay.setMap(null);
        });
        overlays.length = 0;
      }

      function positionToLatLng(position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;
        return new google.maps.LatLng(lat, lng);
      }

      function createBounds(routeBounds) {
        var bounds = new google.maps.LatLngBounds({
          ne: createLatLng(route.bounds.northeast),
          sw: createLatLng(route.bounds.southwest)
        });
      }

      function createLatLng(obj) {
        return new google.maps.LatLng(obj.lat, obj.lng);
      }

      function createRoutePolyline(route) {
        var path = [];
        $log.debug(route.legs.length, 'legs');
        route.legs.forEach(function(leg) {
          $log.debug(leg.steps.length, 'steps');
          leg.steps.forEach(function(step, i, array) {
            var decoded = google.maps.geometry.encoding.decodePath(step.polyline.points);
            if (i === array.length - 1) {
              path = path.concat(decoded);
            } else {
              path = path.concat(decoded.slice(0, decoded.length - 1));
            }
          });
        });
        $log.debug('Total:', path.length, 'points');

        var polyline = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: '#0000ff',
          strokeOpacity: 1.0,
          strokeWeight: 3
        });
        return polyline;
      }
    }
  };
});
