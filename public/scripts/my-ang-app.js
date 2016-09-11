
var app = angular.module('myAngApp', ['ngTouch', 'ui.grid', 'myAngServices']);

app.controller('MainCtrl', ['$scope', '$location', 'TradeService', 'uiGridConstants',
    function ($scope, $location, tradesSvc, gridConstants) {
        $scope.gridViewModel = {
            enableFiltering: true,

            columnDefs: [
                { name: 'Date', field: 'date', sort: { direction: gridConstants.DESC, priority: 0 } },
                { name: 'Stock', field: 'stock' },
                { name: 'Qty', field: 'qty' },
                { name: 'Price', field: 'price' },
                { name: 'B/S', field: 'type' }
            ],
            data: []
        };

        var accountId = $location.absUrl().match(/accounts\/(\d+)/)[1];

        tradesSvc.getTrades(_.toInteger(accountId)).then(
            trades => {
                $scope.gridViewModel.data = trades;
            },
            err => console.error(err));

    }]
);

