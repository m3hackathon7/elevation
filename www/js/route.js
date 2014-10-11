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
      self.currentPosition = position;
    }, function(error) {
      $log.error(error);
    });
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
      var map, marker;

      scope.$watch(attrs.center, function(newValue, oldValue) {
        if (!newValue) {
          return;
        }

        if (map) {
          moveMap(newValue);
        } else {
          showMap(newValue);
        }
      });

      function showMap(position) {
        var latlng = positionToLatLng(position);

        var options = {
          zoom: 14,
          center: latlng,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        map = new google.maps.Map(element[0], options);
        marker = new google.maps.Marker({
          position: latlng,
          map: map
        });
      }

      function moveMap(position) {
        var latlng = positionToLatLng(position);

        map.panTo(latlng);
        marker.setPosition(latlng);
      }

      function positionToLatLng(position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;
        return new google.maps.LatLng(lat, lng);
      }
    }
  };
});
