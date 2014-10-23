angular.module('elevation.terrain', [])

.controller('TerrainCtrl', function() {
  var self = this;
})

.directive('evTerrainViewer', function($cordovaGeolocation,
                                       $log,
                                       $q,
                                       $window,
                                       TerrainViewer,
                                       MapImageService,
                                       MeshElevations) {
  return {
    restrict: 'E',
    scope: {
      route: '='
    },
    link: function(scope, element, attrs) {
      element.css({
        width: '100%',
        height: '600px',
        display: 'block'
      });

      scope.$watch('route', function(newValue, oldValue) {
        if (!scope.route || !scope.route.legs) {
          return;
        }

        // TODO: Add some margin.
        var bounds = scope.route.bounds;

        var rows = 10;
        var cols = 10;

        var terrainPromises = {
          imageUrl: getMapImage(bounds),
          coordGrid: getElevations(bounds, rows, cols),
          route: fillRouteElevation(getRoute(scope.route))
        };
        $q.all(terrainPromises)
          .then(function(terrain) {
            $log.debug('Let us view terrain!');
            $log.debug('Route:', terrain.route);
            var viewer = new TerrainViewer(element[0]);
            viewer.setTerrain(terrain.imageUrl,
                              bounds.northeast.lng,
                              bounds.southwest.lng,
                              bounds.southwest.lat,
                              bounds.northeast.lat);
            viewer.setRoute(terrain.route);
            viewer.setCoordGrid(terrain.coordGrid, rows, cols);
            viewer.setup();
          });
      });
    }
  };

  function getMapImage(bounds) {
    return MapImageService.getMapImage(bounds)
      .then(function(imageData) {
        $log.debug('Got image data', imageData.width, imageData.height);
        $log.debug('Bounds', bounds);
        return imageData.dataUrl;
      }, function(err) {
        $log.error(err);
        return $q.reject(err);
      });
  }

  function getElevations(bounds, rows, cols) {
    return MeshElevations.search(bounds, rows, cols)
      .then(function(points) {
        $log.debug(points);
        return points.map(function(point) {
          return point.elevation;
        });
      });
  }

  function getCenter(bounds) {
    var lat = (bounds.southwest.lat + bounds.northeast.lat) / 2;
    var lng = (bounds.southwest.lng + bounds.northeast.lng) / 2;
    return { lat: lat, lng: lng };
  }

  function getRoute(route) {
    var result = [];
    route.legs.forEach(function(leg, i, legs) {
      leg.steps.forEach(function(step, j, steps) {
        var decoded = google.maps.geometry.encoding.decodePath(step.polyline.points);
        var coords = decoded.map(function(latlng) {
          // TODO: Can't we just use `lng` instead of `lon`?
          return { lat: latlng.lat(), lon: latlng.lng() };
        });

        if (i === legs.length - 1 && j === steps.length - 1) {
          result = result.concat(coords);
        } else {
          // Avoid duplicating last point.
          result = result.concat(coords.slice(0, coords.length - 1));
        }
      });
    });
    return result;
  }

  function fillRouteElevation(route) {
    var deferred = $q.defer();
    var latlngs = route.map(function(point) {
      return new google.maps.LatLng(point.lat, point.lon);
    });
    var elevationService = new ElevationService();
    elevationService.elevation(latlngs, function(points) {
      if (!points) {
        deferred.reject('Failed to get elevations');
        return;
      }
      // TODO: Take immutable way.
      result = route.forEach(function(point, i) {
        console.log(points[i]);
        point.elev = points[i].elevation;
      });
      deferred.resolve(route);
    });
    return deferred.promise;
  }
})

.factory('MapImageService', function($log,
                                     $q,
                                     $document,
                                     TileService) {
  return {
    getMapImage: getMapImage
  };

  /**
   * Creates map image of the given bounds.
   * @param {Object} bounds - an object that has `southwest` and `northwest`.
   * @returns {Promise} promise of created image's data
   * The data consists of width, height and dataUrl.
   */
  function getMapImage(bounds) {
    var deferred = $q.defer();

    var zoomLevel = 15;

    // Pixel size.
    // TODO: Pixel coordinates should be integers.
    var southwestPosition = TileService.getPixelCoordinates(bounds.southwest.lat, bounds.southwest.lng, zoomLevel);
    var northeastPosition = TileService.getPixelCoordinates(bounds.northeast.lat, bounds.northeast.lng, zoomLevel);
    var offsetX = southwestPosition.x % 256;
    var offsetY = northeastPosition.y % 256;
    var pixelWidth = northeastPosition.x - southwestPosition.x;
    var pixelHeight = southwestPosition.y - northeastPosition.y;
    console.log(offsetX, offsetY, pixelWidth, pixelHeight);

    // Tiles.
    var southwestTile = TileService.getTile(bounds.southwest.lat, bounds.southwest.lng, zoomLevel);
    var northeastTile = TileService.getTile(bounds.northeast.lat, bounds.northeast.lng, zoomLevel);
    var xTileCount = northeastTile.x - southwestTile.x + 1;
    var yTileCount = southwestTile.y - northeastTile.y + 1;
    var total = xTileCount * yTileCount;

    var canvas = $document[0].createElement('canvas');
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    var context = canvas.getContext('2d');

    getNumbers(yTileCount).forEach(function(row) {
      getNumbers(xTileCount).forEach(function(col) {
        var x = southwestTile.x + col;
        var y = northeastTile.y + row;
        var image = createImage(x, y);
        image.addEventListener('load', function() {
          $log.debug('Loaded', x, y, image.src);

          context.drawImage(image, col * 256 - offsetX, row * 256 - offsetY);
          total--;

          if (total === 0) {
            $log.debug('Done');
            deferred.resolve({
              width: canvas.width,
              height: canvas.height,
              dataUrl: canvas.toDataURL('image/png')
            });
          }
        });
        image.addEventListener('error', function() {
          deferred.reject(new Error('Failed to load image: ' + image.src));
        });
      });
    });

    return deferred.promise;
  }

  function createImage(x, y) {
    var image = new Image();
    image.crossOrigin = 'Anonymous';
    image.src = TileService.getUrl(x, y, 15, 'ort', 'jpg');
    image.width = 256;
    image.height = 256;
    return image;
  }

  function getNumbers(size) {
    var result = [];
    for (var i = 0; i < size; i++) {
      result.push(i);
    }
    return result;
  }
})

.factory('TileService', function() {
  return {
    getTileUrl: getTileUrl,
    getTileUrls: getTileUrls,
    getTile: getTile,
    getUrl: getUrl,
    getPixelCoordinates: getPixelCoordinates
  };

  /**
  * Converts degree to radian.
  * @param {Number} degree
  * @returns {Number}
  */
  function degreeToRadian(degree) {
    return degree / 180.0 * Math.PI;
  }

  /**
  * Converts latitude and longitude in degree to world coordinates.
  * https://developers.google.com/maps/documentation/javascript/examples/map-coordinates
  * @param {Number} lat - latitude in degree
  * @param {Number} lng - longitude in degree
  * @returns {Number}
  */
  function getWorldCoordinates(lat, lng) {
    var latRadian = degreeToRadian(lat);
    var lngRadian = degreeToRadian(lng);

    var x = 128 / Math.PI * (lngRadian + Math.PI);
    var y = -128 / Math.PI / 2 * Math.log((1 + Math.sin(latRadian)) / (1 - Math.sin(latRadian))) + 128;

    return { x: x, y: y };
  }

  /**
  * Converts latitude and longitude in degree to pixel coordinates.
  * https://developers.google.com/maps/documentation/javascript/examples/map-coordinates
  * @param {Number} lat - latitude in degree
  * @param {Number} lng - longitude in degree
  * @param {Number} zoom - zoom level
  * @returns {Number}
  */
  function getPixelCoordinates(lat, lng, zoom) {
    var worldCoords = getWorldCoordinates(lat, lng);
    var scale = Math.pow(2, zoom);
    var x = worldCoords.x * scale;
    var y = worldCoords.y * scale;
    return { x: x, y: y };
  }

  /**
  * Get tile coordinates.
  * @param {Number} lat - latitude in degree
  * @param {Number} lng - longitude in degree
  * @param {Number} zoom
  * @returns {Object} an object with x and y
  */
  function getTile(lat, lng, zoom) {
    var worldCoords = getWorldCoordinates(lat, lng);

    var unit = 256 / Math.pow(2, zoom);

    var x = ~~(worldCoords.x / unit);
    var y = ~~(worldCoords.y / unit);

    return { x: x, y: y };
  }

  /**
  * Get tile image URL from geographical coordinates.
  * @param {Number} lat
  * @param {Number} lng
  * @param {Number} zoom
  * @param {String} id - tile type like 'std' and 'ort'
  * @param {String} ext - file extension
  * @returns {String} image URL
  */
  function getTileUrl(lat, lng, zoom, id, ext) {
    var xy = getTile(lat, lng, zoom);
    return getUrl(xy.x, xy.y, zoom, id, ext);
  }

  /**
  * Get tile image URL from position.
  * @param {Number} x
  * @param {Number} y
  * @param {Number} zoom
  * @param {String} id
  * @param {String} ext
  * @returns {String} image URL
  */
  function getUrl(x, y, zoom, id, ext) {
    var base = 'http://cyberjapandata.gsi.go.jp/xyz';
    return [base, id, zoom, x, y + '.' + ext].join('/');
  }

  /**
  * Get tile URLs in the given region.
  * @param {Number} southLat
  * @param {Number} westLng
  * @param {Number} northLat
  * @param {Number} eastLng
  * @param {Number} zoom
  * @param {String} id
  * @param {String} ext
  * @returns {Array} array of array of URLs
  */
  function getTileUrls(southLat, westLng, northLat, eastLng, zoom, id, ext) {
    var minXY = getTile(northLat, westLng, zoom);
    var maxXY = getTile(southLat, eastLng, zoom);

    var result = [];
    var row;
    for (var y = minXY.y; y <= maxXY.y; y++) {
      row = [];
      for (var x = minXY.x; x <= maxXY.x; x++) {
        row.push(getUrl(x, y, zoom, id, ext));
      }
      result.push(row);
    }
    return result;
  }
})

.factory('TerrainViewer', function($window) {
  return $window.TerrainViewer;
})

.factory('MeshElevations', function($log, $q, Elevations) {
  return {
    search: getElevations
  };

  function getElevations(bounds, row, col) {
    var deferred = $q.defer();
    var latlngs = prepareLatLngs(bounds, row, col);

    var elevationService = new ElevationService();
    elevationService.elevation(latlngs, function(points) {
      if (!points) {
        deferred.reject('Failed to get elevations');
        return;
      }
      deferred.resolve(points);
    });

    return deferred.promise;
  }

  function prepareLatLngs(bounds, rows, cols) {
    // TODO: 地図の大きさに合わせる？
    var latStep = (bounds.northeast.lat - bounds.southwest.lat) / rows;
    var lngStep = (bounds.northeast.lng - bounds.southwest.lng) / cols;

    var result = [];
    // 北から南へ、西から東への方向。
    for (var row = rows; row >= 0; row--) {
      for (var col = 0; col <= cols; col++) {
        result.push(new google.maps.LatLng(
          bounds.southwest.lat + latStep * col,
          bounds.southwest.lng + lngStep * row
        ));
      }
    }

    $log.debug('Prepared LatLngs:', result);
    return result;
  }
});
