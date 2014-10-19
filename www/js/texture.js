angular.module('elevation.texture', [])

.controller('TextureCtrl', function() {
  var self = this;
})

.directive('evGsiTiles', function($cordovaGeolocation,
                                  $log,
                                  TextureService) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var canvas = element[0];
      canvas.width = 256 * 3;
      canvas.height = 256 * 3;
      var context = canvas.getContext('2d');

      $cordovaGeolocation.getCurrentPosition()
        .then(function(position) {
          $log.debug(position);
          var lat = position.coords.latitude;
          var lng = position.coords.longitude;

          var tile = TextureService.getTile(lat, lng, 15);

          var nums = [0, 1, 2];
          var total = 3 * 3;
          nums.forEach(function(row) {
            nums.forEach(function(col) {
              var x = tile.x + col;
              var y = tile.y + row;
              var image = new Image();
              image = new Image();
              image.crossOrigin = 'Anonymous';
              image.src = TextureService.getUrl(x, y, 15, 'ort', 'jpg');
              image.width = 256;
              image.height = 256;
              image.addEventListener('load', function() {
                $log.debug('Loaded', x, y, image.src);

                context.drawImage(image, col * 256, row * 256);
                total--;

                if (total === 0) {
                  $log.debug('Done');
                  // var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                  var imageData = canvas.toDataURL('image/png');
                  $log.debug(imageData);
                }
              });
            });
          });
        });
    }
  };
})

.factory('TextureService', function() {
  return {
    getTileUrl: getTileUrl,
    getTileUrls: getTileUrls,
    getTile: getTile,
    getUrl: getUrl
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
});
