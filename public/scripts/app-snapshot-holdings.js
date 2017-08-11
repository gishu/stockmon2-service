
var app = angular.module('snapshotHoldingsApp', ['ngTouch', 'ui.grid', 'ui.grid.exporter', 'myAngServices']);

app.controller('MainCtrl', ['$scope', '$location', 'TradeService', 'StockQuoteService', 'uiGridConstants',
    function ($scope, $location, tradesSvc, quoteSvc, gridConstants) {
        var getAgeBin = function (age_months) {
            if (age_months < 12) {
                return (age_months < 9 ? "SHORT" : "ALMOST");
            } else {
                return "";
            }

        }

        BigNumber.config({ DECIMAL_PLACES: 2 });

        $scope.gridViewModel = {
            enableFiltering: true,
            enableGridMenu: true,
            exporterCsvFilename: 'snapshotHoldings.csv',

            columnDefs: [
                {
                    name: 'Stock', field: 'stock', sort: { direction: gridConstants.ASC, priority: 0 }, width: '15%'
                },

                { name: 'Date', field: 'date', sort: { direction: gridConstants.DESC, priority: 1 } },
                { name: 'Units', field: 'qty', cellClass: 'money' },
                { name: 'Price', field: 'price_f', type: 'number', cellClass: 'money' },
                {
                    name: 'Age', field: 'age', cellClass: function (grid, row, col, rIndex, cIndex) {
                        var cellValue = grid.getCellValue(row, col);
                        if (cellValue.length === 0) return;
                        return (cellValue === 'SHORT' ? 'st2-short' : 'st2-almost');
                    }
                },
                { name: 'MarketPrice', field: 'market_price', cellClass: 'money' },
                { name: 'Change', field: 'change', cellClass: 'money' },
                { name: 'Cost (K)', field: 'cost', type: 'number', cellClass: 'money' },
                { name: 'Gain (K)', field: 'gain', type: 'number', cellClass: 'money' },
                { name: '%', field: 'gain_percent', type: 'number', cellClass: 'money' },
                { name: 'ROI', field: 'roi', type: 'number', cellClass: 'money' },
                { name: 'Notes', field: 'notes', type: 'string', width: '20%' }
            ],
            rowTemplate: `<div ng-class="{'st2-loss':row.entity.gain_percent < -15, 'st2-profit': row.entity.gain_percent > 25}"> 
             <div ng-repeat="col in colContainer.renderedColumns track by col.colDef.name"  class="ui-grid-cell" ui-grid-cell></div>
             </div>`,


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
                        age: getAgeBin(h.age_months),
                        ageInYears: (h.age_months / 12).toFixed(2),
                        notes: h.notes
                    }
                });
                $scope.gridViewModel.data = viewModel;
                return quoteSvc.getQuotesFor(_(holdings).map(h => h.stock).uniq().value());
            })
            .then(quotes => {
                _.each(viewModel, model => {
                    var quote = quotes[model.stock];
                    if (quote) {

                        model.cost = new BigNumber(model.price).times(model.qty).div(1000).toFixed(2);
                        model.gain = new BigNumber(quote.p).minus(model.price).times(model.qty).div(1000).toFixed(2);
                        model.gain_percent = new BigNumber(quote.p).minus(model.price).div(model.price).times(100).toFixed(2);
                        model.roi = ((model.ageInYears < 12)
                            ? (new BigNumber(quote.p).minus(model.price).div(model.price).div(model.ageInYears).mul(100)).toFixed(2)
                            : (42));
                        model.market_price = quote.p.toFixed(2);
                        model.change = quote.c.toFixed(2);
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

