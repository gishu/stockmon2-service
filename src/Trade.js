var parse = require('./util/parse.js');
var moment = require('moment');
var _ = require('lodash');

function makeTrade(date, stock, qty, price, is_buy, brokerage, notes) {
    var parsedPrice = parse.toBigNumber(price),
        parsedBrokerage = parse.toBigNumber(brokerage);

    return {
        'date': parse.toDate(date),
        'stock': _.toUpper(stock),
        'qty': qty,
        'is_buy': is_buy,
        'price': parsedPrice,
        'brokerage': parsedBrokerage,
        'notes': notes || ''
    };
}
function makeBuy(date, stock, qty, price, brokerage, notes) {
    return makeTrade(date, stock, qty, price, true, brokerage, notes);
}
function makeSale(date, stock, qty, price, brokerage, notes) {
    return makeTrade(date, stock, qty, price, false, brokerage, notes);
}



function makeGain(sale, buy, qty, brokerage_amt, isShortTerm) {
    let cp = parse.toBigNumber(buy.price),
        sp = parse.toBigNumber(sale.price),
        brokerage = parse.toBigNumber(brokerage_amt),
        buyDate = parse.toDate(buy.date),
        saleDate = parse.toDate(sale.date);

    let noOfYears = saleDate.diff(buyDate, 'years', true).toFixed(3),
        totalGain = sp.minus(cp).times(qty).minus(brokerage),

        roi = 0;
    if (cp.greaterThan(0) && noOfYears > 0.1) {
        if (isShortTerm) {
            // simple rate of interest
            roi = totalGain.div(qty).div(cp).div(noOfYears);
        } else {
            // cagr
            let cagrBase = totalGain.div(qty).plus(cp).div(cp);
            roi = Math.pow(cagrBase, (1 / noOfYears)) - 1;
        }
    }


    return {
        'date': saleDate,
        'buyDate': buyDate,
        'stock': sale.stock,
        'qty': qty,
        'buyId': buy.id,
        'CP': cp,
        'saleId': sale.id,
        'SP': sp,
        'brokerage': brokerage,
        'gain': totalGain,
        'isShortTerm': isShortTerm,
        'roi': Math.round(roi * 10000) / 10000  // round to 4 decimal places
    };
}
function makeDividend(date, stock, amount, notes) {
    return {
        'date': parse.toDate(date),
        'stock': _.toUpper(stock),
        'amount': parse.toBigNumber(amount),
        'notes': notes || ''
    };
}
function loadBuy(row) {
    var buy = makeBuy(moment(row.Date).toDate(), row.Stock, row.Qty, row.Price, row.Brokerage, row.Notes);
    buy.id = row.Id || row.buy_id; // stmts will use their foreign key
    return buy;
}
function loadSale(row) {
    var sale = makeSale(moment(row.Date), row.Stock, row.Qty, row.Price, row.Brokerage, row.Notes);
    sale.id = row.Id;
    return sale;

}
function loadDiv(row) {
    var div = makeDividend(moment(row.Date).toDate(), row.Stock, row.Amount, row.Notes);
    div.id = row.Id;
    return div;
}

module.exports = {
    makeBuy: makeBuy,
    makeSale: makeSale,
    makeDividend: makeDividend,
    makeGain: makeGain,
    loadBuy: loadBuy,
    loadSale: loadSale,
    loadDiv: loadDiv
};