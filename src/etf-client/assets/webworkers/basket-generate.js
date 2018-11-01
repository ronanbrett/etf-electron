var __assign =
  (this && this.__assign) ||
  function() {
    __assign =
      Object.assign ||
      function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };

var BasketService = /** @class */ (function() {
  function BasketService() {
    this.TRADING_INCREMENTS = {
      '24061105': 0.01,
    };
    this.NAV = 180.15;
    this.CU = 50000;
    this.BSKT_SIZE = this.NAV * this.CU;

    this.countDecimels = function(number) {
      if (Math.floor(number.valueOf()) === number.valueOf()) {
        return 0;
      }
      return number.toString().split('.')[1].length || 0;
    }

    this.roundTo = function(number, decimals) {
      var dec = this.countDecimels(decimals);
      return Math.floor(number * Math.pow(10, dec)) / Math.pow(10, dec);
    }


  }

  BasketService.prototype.reset = function(nav, cu) {
    this.NAV = nav  || 180.15;
    this.CU = cu || 50000;
    this.BSKT_SIZE = this.NAV * this.CU;
  };

  BasketService.prototype.formatData = function(data, prevData) {
    var dataWithMarketValue;
    if (data) {
      dataWithMarketValue = data.map(function(x) {
        return {
          id: x.Identifier,
          ticker: x.Ticker,
          name: x.Name,
          shares: Number(x.Shares),
          price: Number(x.Price),
          marketValue: x.Shares * x.Price,
        };
      });
    } else if (prevData) {
      dataWithMarketValue = prevData.map(function(x) {
        return {
          id: x.id,
          ticker: x.ticker,
          name: x.name,
          shares: Number(x.shares),
          price: Number(x.price),
          marketValue: Number(x.shares) * Number(x.price),
        };
      });
    }
    var totalNav = dataWithMarketValue.reduce(function(accum, x, i) {
      return accum + x.marketValue;
    }, 0);
    var dataWithWeights = dataWithMarketValue.reduce(function(accum, x) {
      return accum.concat([
        __assign({}, x, { weight: x.marketValue / totalNav }),
      ]);
    }, []);
    return dataWithWeights;
  };
  BasketService.prototype.getIdealBasketValues = function(data) {
    var _this = this;
    var dataWithIdeals = data.reduce(function(accum, x, i) {
      var idealBsktValue = _this.BSKT_SIZE * x.weight;
      var idealBsktShares = idealBsktValue / x.price;
      var tradingIncrements = _this.TRADING_INCREMENTS[x.id]
        ? _this.TRADING_INCREMENTS[x.id]
        : 1;
      var tradingIncrementsValue = x.price * tradingIncrements;
      return accum.concat([
        __assign({}, x, {
          idealBsktValue: idealBsktValue,
          idealBsktShares: idealBsktShares,
          tradingIncrements: tradingIncrements,
          tradingIncrementsValue: tradingIncrementsValue,
        }),
      ]);
    }, []);
    this.oneCreationUnitValue = dataWithIdeals.reduce(function(accum, x) {
      return accum + x.idealBsktValue;
    }, 0);
    return dataWithIdeals;
  };
  BasketService.prototype.getFirstIteration = function(data) {
    var _this = this;

    var dataFirstIteration = data.reduce(function(accum, x, i) {
      var sharesFirstIteration = _this.roundTo(
        x.idealBsktShares,
        x.tradingIncrements
      );

      var valueFirstIteration = x.price * sharesFirstIteration;


      return accum.concat([
        __assign({}, x, {
          sharesFirstIteration: sharesFirstIteration,
          valueFirstIteration: valueFirstIteration,
        }),
      ]);
    }, []);
    this.firstIterationBsktVal = dataFirstIteration.reduce(function(accum, x) {
      return accum + x.valueFirstIteration;
    }, 0);
    this.reserve = this.BSKT_SIZE - this.firstIterationBsktVal;
    return dataFirstIteration;
  };
  BasketService.prototype.testPositions = function(data) {
    var testPositions = data.reduce(function(accum, x, i) {
      var test1 =
        x.idealBsktShares < x.tradingIncrements
          ? x.idealBsktShares / x.tradingIncrements
          : 0;
      var test2 =
        x.sharesFirstIteration === 0
          ? x.idealBsktShares / x.tradingIncrements
          : (x.idealBsktShares - x.sharesFirstIteration) / x.tradingIncrements;
      var allocation = test1 > test2 ? test1 : test2;
      return accum.concat([
        __assign({}, x, { idealAllocationPercent: allocation }),
      ]);



    }, []);

    testPositions = testPositions.sort(function (a, b) {
      return b.idealAllocationPercent - a.idealAllocationPercent;
    });

    return testPositions;
  };
  BasketService.prototype.getAllocationLotPrices = function(data) {
    var _this = this;
    var allocationData = data.reduce(function(accum, x, i) {
      var price =
        _this.reserve > x.tradingIncrementsValue ? x.tradingIncrementsValue : 0;
      _this.reserve = _this.reserve - price;

      var lots = price > 0 ? x.tradingIncrements : 0;
      return accum.concat([
        __assign({}, x, {
          newPrice: price,
          newLots: lots,
          reserve: _this.reserve,
        }),
      ]);
    }, []);
    return allocationData;
  };
  BasketService.prototype.calculateNewBasketValues = function(data) {
    var basketValues = data.reduce(function(accum, x) {
      var newBsktShares = x.newLots + x.sharesFirstIteration;
      var newBsktValue = newBsktShares * x.price;
      return accum.concat([
        __assign({}, x, {
          newBsktShares: newBsktShares,
          newBsktValue: newBsktValue,
        }),
      ]);
    }, []);
    return basketValues;
  };
  return BasketService;
})();

var basket = new BasketService();

onmessage = function(e) {
  self.basket.reset();

  var incomingData = e.data.data;
  var prevData = e.data.prevData;

  var dataFormatted = self.basket.formatData(incomingData, prevData);
  var dataIdealBsktValues = self.basket.getIdealBasketValues(dataFormatted);
  var firstIteration = self.basket.getFirstIteration(dataIdealBsktValues);
  var testPositions = self.basket.testPositions(firstIteration);
  var allocations = self.basket.getAllocationLotPrices(testPositions);
  var basket = self.basket.calculateNewBasketValues(allocations);
  postMessage(basket);
};
