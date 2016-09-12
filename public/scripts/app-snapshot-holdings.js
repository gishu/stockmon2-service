
var app = angular.module('snapshotHoldingsApp', ['ngTouch', 'ui.grid', 'myAngServices']);

app.controller('MainCtrl', ['$scope', '$location', 'TradeService', 'StockQuoteService', 'uiGridConstants',
    function ($scope, $location, tradesSvc, quoteSvc, gridConstants) {
        var getAgeBin = function () {
            if (this.age_months < 12) {
                return (this.age_months <= 9 ? "SHORT" : "ALMOST");
            } else {
                return "";
            }

        }

        BigNumber.config({ DECIMAL_PLACES: 2 });

        $scope.gridViewModel = {
            enableFiltering: true,

            columnDefs: [
                {
                    name: 'Stock', field: 'stock', sort: { direction: gridConstants.ASC, priority: 0 }, width: '15%'
                },

                { name: 'Date', field: 'date', sort: { direction: gridConstants.DESC, priority: 1 } },
                { name: 'Units', field: 'qty', cellClass: 'money' },
                { name: 'Price', field: 'price_f', type: 'number', cellClass: 'money' },
                { name: 'Age', field: 'age()' },
                { name: 'MarketPrice', field: 'market_price', cellClass: 'money' },
                { name: 'Change', field: 'change', cellClass: 'money' },
                { name: 'Range', field: 'range52week', width: '15%' },

                { name: 'Gain', field: 'gain', type: 'number', cellClass: 'money' },
                { name: 'Percent', field: 'gain_percent', type: 'number', cellClass: 'money' }
            ],
            rowTemplate: '<div ng-class="{\'almost\':row.entity.age_months<12 && row.entity.age_months>9, \'short\':row.entity.age_months<=9  }" <div ng-repeat="col in colContainer.renderedColumns track by col.colDef.name"  class="ui-grid-cell" ui-grid-cell></div></div>',


            data: []
        };

        var
            accountId = $location.absUrl().match(/accounts\/(\d+)/)[1],
            year = $location.absUrl().match(/snapshots\/(\d+)/)[1];

        $scope.year = year;

        var viewModel;
        tradesSvc.getHoldingsForYear(accountId, year)
            .then(holdings => {
                $scope.rawHoldings = holdings;
                viewModel = _.map(holdings, function (h) {
                    return {
                        stock: h.stock,
                        date: h.date,
                        qty: h.qty,
                        price: h.price,
                        price_f: h.price.toString(),
                        age_months: h.age_months
                    }
                });
                $scope.gridViewModel.data = viewModel;
                return quoteSvc.getQuotesFor(_(holdings).map(h => h.stock).uniq().value());
            })
            .then(quotes => {
                _.each(viewModel, model => {
                    model.age = getAgeBin;
                    var quote = quotes[model.stock];
                    if (quote) {

                        model.gain = new BigNumber(quote.p).minus(model.price).times(model.qty).toFixed(2);
                        model.gain_percent = new BigNumber(quote.p).minus(model.price).div(model.price).times(100).toFixed(2);

                        model.market_price = quote.p.toFixed(2);
                        model.change = quote.c.toFixed(2);
                        model.range52week = quote.r52;

                    } else {
                        console.error('Did not get quote for ' + model.stock);
                    }
                });
                $scope.gridViewModel.data = viewModel;
            })
            .catch(err => {
                console.error(err);
            });

    }]
);

