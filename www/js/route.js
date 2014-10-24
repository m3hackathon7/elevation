angular.module('elevation.route', [])

.controller('RouteCtrl', function() {
})

.factory('Location', function($cordovaGeolocation, $log) {
  function getCurrentPosition() {
    return $cordovaGeolocation
      .getCurrentPosition()
      .then(function (position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;
        $log.debug('latitude', lat, 'longitude', lng);
        return { latitude: lat, longitude: lng };
      }, function(err) {
        $log.error(err);
      });
  }

  return {
    currentPosition: getCurrentPosition
  };
})

.provider('Routes', function() {
  var url = 'https://maps.googleapis.com/maps/api/directions/json';

  this.setUrl = function(newUrl) {
    url = newUrl;
  };

  this.$get = function($http) {
    return {
      search: search
    };

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
  };
})

.provider('Elevations', function() {
  var url = 'https://maps.googleapis.com/maps/api/elevation/json';

  this.setUrl = function(newUrl) {
    url = newUrl;
  };

  this.$get = function($http, $log) {
    return {
      search: search
    };

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
      // Map information retention.
      self.map = map;

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
      var height = 160 - margin.top - margin.bottom;
      $log.debug(width, height);

      var x = d3.scale.linear()
        .range([0, width]);
      var y = d3.scale.linear()
        .range([height, 0]);

      var xAxisFunc = d3.svg.axis()
        .scale(x)
        .orient('bottom')
        .ticks(5);
      var yAxisFunc = d3.svg.axis()
        .scale(y)
        .orient('left')
        .ticks(5);

      var area = d3.svg.area()
        .x(function(d) { return x(d.distance); })
        .y0(height)
        .y1(function(d) { return y(d.elevation); });

      var svg = d3.select(element[0]).append('svg')
        .attr('width', width + margin.right + margin.left)
        .attr('height', height + margin.top + margin.bottom)
      .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      var xAxis = svg.append('g')
        .attr('class', 'elevation-chart-axis elevation-chart-axis-x')
        .attr('transform', 'translate(0, ' + height + ')');

      var yAxis = svg.append('g')
        .attr('class', 'elevation-chart-axis elevation-chart-axis-y');

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

        svg.selectAll('path.elevation-chart-area')
          .data([data])
          .attr('d', area)
        .enter().append('path')
          .attr('class', 'elevation-chart-area')
          .attr('d', area);

        xAxis.call(xAxisFunc);
        yAxis.call(yAxisFunc);

        yAxis.selectAll('text.elevation-chart-legend')
          .data(['We want only one legend here.'])
        .enter().append('text')
          .attr('class', 'elevation-chart-legend')
          .attr('transform', 'rotate(-90)')
          .attr('y', 6)
          .attr('dy', '.71em')
          .style('text-anchor', 'end')
          .text('Elevation (m)');
      }
    }
  };
})

.directive('evAutocomplete', function($log, $timeout, $window) {
  return {
    restrict: 'A',
    require: '?ngModel',
    link: function(scope, element, attrs, ngModel) {
      $log.info('autocomplete');
      var autocomplete = new google.maps.places.Autocomplete(element[0]);
      google.maps.event.addListener(autocomplete, 'place_changed', function() {
        // getPlace()'s result has inconsistent structure.
        // var place = autocomplete.getPlace();
        var address = element.prop('value')
        ngModel.$setViewValue(address);
      });

      hack();

      function hack() {
        var containers = $window.document.querySelectorAll('.pac-container')
        if (!containers || containers.length === 0) {
          // Wait for pac-container to appear.
          $timeout(hack, 500);
          return;
        }
        containers = angular.element(containers);
        containers.attr('data-tap-disabled', 'true');
        containers.on('click', onClick);
        containers.on('mousedown', onClick);
      }

      function onClick(e) {
        element[0].blur();
        e.stopPropagation();
        e.preventDefault();
      }
    }
  };

});
