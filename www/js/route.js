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

.factory('Elevations', function($http, $log) {
  var url = 'https://maps.googleapis.com/maps/api/elevation/json';
  // API proxy for browser testing.
  if (!window.cordova) {
    url = 'http://localhost:3333/elevations';
  }

  function search(points) {
    var locations = points.map(function(point) {
      return [point.lat, point.lng].join(',');
    }).join('|');
    var params = {
      locations: locations
    };
    $log.debug('locations length:', locations.length, 'points:', points.length);
    $log.debug(locations);
    return $http.get(url, { params: params })
      .then(function(response) {
        return response.data;
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
      var polyline;
      var marker;

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
        if (polyline) {
          polyline.setMap(null);
          polyline = null;
        }
        polyline = createRoutePolyline(route);
        polyline.setMap(map);

        var bounds = createBounds(route.bounds);
        map.panToBounds(bounds);
      }

      function addMarker(latlng) {
        if (marker) {
          marker.setMap(null);
          marker = null;
        }
        marker = new google.maps.Marker({
          position: latlng
        });
        marker.setMap(map);
      }
    }
  };

  function positionToLatLng(position) {
    var lat = position.coords.latitude;
    var lng = position.coords.longitude;
    return new google.maps.LatLng(lat, lng);
  }

  function createBounds(routeBounds) {
    return new google.maps.LatLngBounds(
      createLatLng(routeBounds.southwest),
      createLatLng(routeBounds.northeast)
    );
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
})

.directive('evElevationChart', function($log, Elevations) {
  return {
    restrict: 'E',
    scope: {
      route: '='
    },
    link: function(scope, element, attrs) {
      scope.$watch('route', function(newValue, oldValue) {
        if (scope.route && scope.route.legs) {
          var data = prepareData(scope.route);
          $log.debug(data);
          Elevations.search(data)
            .then(function(result) {
              $log.debug(result);
              var elevations = result.results;
              data.forEach(function(point, i) {
                point.elevation = elevations[i].elevation;
              });
              showRoute(data);
            });
        }
      });

      var margin = {
        top: 20,
        right: 20,
        bottom: 30,
        left: 50
      };
      var width = element.prop('offsetWidth') - margin.left - margin.right;
      var height = 300 - margin.top - margin.bottom;
      $log.debug(width, height);

      var x = d3.scale.linear()
        .range([0, width]);
      var y = d3.scale.linear()
        .range([height, 0]);

      var xAxis = d3.svg.axis()
        .scale(x)
        .orient('bottom');
      var yAxis = d3.svg.axis()
        .scale(y)
        .orient('left');

      var area = d3.svg.area()
        .x(function(d) { return x(d.distance); })
        .y0(height)
        .y1(function(d) { return y(d.elevation); });

      var svg = d3.select(element[0]).append('svg')
        .attr('width', width + margin.right + margin.left)
        .attr('height', height + margin.top + margin.bottom)
      .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      function prepareData(route) {
        var points = [];
        var distance = 0;
        route.legs.forEach(function(leg) {
          leg.steps.forEach(function(step, i, array) {
            points.push(createPoint(step.start_location, distance));
            distance += step.distance.value;
            if (i === array.length - 1) {
              points.push(createPoint(step.end_location, distance));
            }
          });
        });
        return points;
      }

      function createPoint(location, distance) {
        return angular.extend({
          distance: distance,
          elevation: Math.random() * 10
        }, location);
      }

      function showRoute(data) {
        x.domain([0, d3.max(data, function(d) { return d.distance; })]);
        y.domain([0, d3.max(data, function(d) { return d.elevation; })]);

        svg.append('path')
          .datum(data)
          .attr('class', 'elevation-chart-area')
          .attr('d', area);
        svg.append('g')
          .attr('class', 'elevation-chart-axis elevation-chart-axis-x')
          .attr('transform', 'translate(0, ' + height + ')')
          .call(xAxis);
        svg.append('g')
          .attr('class', 'elevation-chart-axis elevation-chart-axis-y')
          .call(yAxis)
        .append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', 6)
          .attr('dy', '.71em')
          .style('text-anchor', 'end')
          .text('Elevation (m)');
      }
    }
  };
});
