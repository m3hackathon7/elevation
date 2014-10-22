//---------------------------------
// Elevation
//---------------------------------

function ElevationService() {
  this.LIMIT_SIZE = 100;

  this.ELEV_STATUS_MSGS = {};
  this.ELEV_STATUS_MSGS[google.maps.ElevationStatus.INVALID_REQUEST] =
      "リクエストが不正";
  this.ELEV_STATUS_MSGS[google.maps.ElevationStatus.OVER_QUERY_LIMIT] =
      "クエリを送りすぎです";
  this.ELEV_STATUS_MSGS[google.maps.ElevationStatus.REQUEST_DENIED] =
      "ElevationResultが拒否されました";
  this.ELEV_STATUS_MSGS[google.maps.ElevationStatus.UNKNOWN_ERROR] =
      "原因不明のトラブル";


  this.gelevation = new google.maps.ElevationService();
  this.queue = [];
  this.callback = {success: function() {}};
}

ElevationService.prototype = {
  /**
   * LatLng配列でのpathに対して高度情報を取得
   * callback([{location: LatLng, elevation: 高度},...])
   */
  elevation : function(path, callback) {
    this.queue.push({path: path, callback: callback});

    if (this.queue.length == 1) {
      this._deque();
    }

    return this;
  },

  _deque: function() {
    var self = this;

    var arg = this.queue[0];
    if (!arg) {
      this.callback.success();
      return;
    }

    this._elevation(arg.path, 0, [], function(results) {
      arg.callback(results);

      setTimeout(function() {
        self.queue.shift(); //今処理したのを除去
        self._deque();
      }, 100);
    });
  },

  _elevation : function(path, start, locs, callback) {
    // finish
    if (path.length <= start) {
      callback(locs);
      return;
    }

    var self = this;
    var end = start + this.LIMIT_SIZE;

    console.log(start, end, path.slice(start, end));

    this.gelevation.getElevationForLocations({
      locations: path.slice(start, end)
    }, function(results, status) {
      if (status != google.maps.ElevationStatus.OK) {
        console.log(self.ELEV_STATUS_MSGS[status]);
        callback(null);
        return;
      }

      locs = locs.concat(results);

      setTimeout(function() {
        self._elevation(path, end, locs, callback);
      }, 500);
    });
  },

  success: function(func) {
    this.callback['success'] = func;
  },

  doSuccess: function() {
    var self = this;
    setTimeout(function() {
      self.callback.success();
    }, 100);
  }
};
