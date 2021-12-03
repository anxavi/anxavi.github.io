Moralis.start({ serverUrl: "https://yn0vczpsv6k3.usemoralis.com:2053/server", 
appId: "KoryTww3CCjFtrsUa8ze6ZonbBR6Dhe74zP9izsE" });

let currentTrade = {};
let currentSelectSide;
let tokens;
let user;
let balances = {};
let tokenInBalance = 0.0;
let fromAmount = 0.00;
let toAmount = 0.00
let isFromAmountInput = true; // true if user input on "from amount", false if user input on "to amount"
let dex;
let web3;
const DECIMALS = 5;
const API_1INCH_BASE = "https://api.1inch.exchange/v3.0/97/";
const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const WBNB_ADDRESS = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd';    // WBNB mainnet/testnet 0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c
const CASH_ADDRESS = '0xa356cfa940cc5f30233da30e95493ad9f0a58327';    // mainnet/testnet - DSWAP1
const COW_ADDRESS = '0x6bbd4cf9ddde08b68bef0ac7409946be3553ed92';     // mainnet/testnet - DWSAP2
const USDT_ADDRESS = '0x8301f2213c0eed49a7e28ae4c3e91722919b8b47';    // mainnet/testnet 
const TESTNET_ID = 97; // 56 for mainnet
const GAS_PRICE = 5.8; // Gwei
const networks = {
  1: 'eth',
  4: 'rinkeby',
  56: 'bsc',
  97: 'bsc testnet',
  137: 'matic',
  80001: 'mumbai'
};

// currently, Moralis plugin doesn't support protocols parameter so we will call 1inch API directly with protocol PANCAKESWAP_V2. Because without protocols parameter, the 1inch API return wrong price when the amount is <= 1 usdt due to the fee is often > 1usdt. And the important thing is the price from 1Inch without protocols parameter is average price from many dexes so and we want it to be the same with pancakeswap.

setInterval(function () {
  loadCashPrice();
}, 5000);

setInterval(function () {
  loadCowPrice();
}, 5000);

async function init() {
  storeReference();
  await Moralis.initPlugins();
  dex = Moralis.Plugins.oneInch;
  await listAvailableTokens();
  await renderInterface();
  currentTrade.from = tokens[NATIVE_ADDRESS];
  currentTrade.to = tokens[CASH_ADDRESS];
  renderSwapInfo();
  const options = {
    delay: 30000,
  };
  $('.toast-container .toast').toast(options);

  const infoOptions = {
    delay: 20000,
  }
  $('.info-toast-container .toast').toast(infoOptions);
}

$('.toast-container .toast').on('hidden.bs.toast', function () {
  $('.toast-container').css("z-index", "-1");
});

$('.info-toast-container .toast').on('hidden.bs.toast', function () {
  $('.info-toast-container').css("z-index", "-1");
});

function storeReference() {
  const url = new URL(window.location.href);
  reference = url.searchParams.get("ref");
  if (reference) {
    window.localStorage.setItem('reference', reference);
  }
}

async function listAvailableTokens() {
  const result = await dex.getSupportedTokens({
    chain: 'bsc', // The blockchain you want to use (eth/bsc/polygon)
  });
  tokens = result.tokens;
  tokens[CASH_ADDRESS] = {
    symbol: 'CASH',
    name: 'Caash',
    decimals: 18,
    address: CASH_ADDRESS,
    logoURI: '/images/caash.webp'
  }
  tokens[COW_ADDRESS] = {
    symbol: 'COW',
    name: 'CaashCOW',
    decimals: 18,
    address: COW_ADDRESS,
    logoURI: '/images/cow.png'
  }
  showTokensList(tokens);
}

async function loadCashPrice() {
  const options = {
    address: CASH_ADDRESS,
    chain: "bsc testnet",
    exchange: "PancakeSwapv2"
  };
  const cashPrice = await Moralis.Web3API.token.getTokenPrice(options);
  $('#cash_price').text(Number(cashPrice.usdPrice.toFixed(DECIMALS)));
}

async function loadCowPrice() {
  const options = {
    address: COW_ADDRESS,
    chain: "bsc testnet",
    exchange: "PancakeSwapv2"
  };
  const cowPrice = await Moralis.Web3API.token.getTokenPrice(options);
  $('#cow_price').text(Number(cowPrice.usdPrice.toFixed(DECIMALS)));
}

function showTokensList(filteredTokens) {
  let parent = document.getElementById("token_list");
  $(parent).html('');
  for (const address in filteredTokens) {
    let token = filteredTokens[address];
    let div = document.createElement("div");
    div.setAttribute("data-address", address)
    div.className = "token_row";
    let html = `
        <img class="token_list_img" src="${token.logoURI}">
        <span class="token_list_text">${token.symbol}</span>
        `
    div.innerHTML = html;
    parent.appendChild(div);
  }
  if (filteredTokens[CASH_ADDRESS] !== undefined && filteredTokens[WBNB_ADDRESS] !== undefined) {
    const cowHtml = $(`.token_row[data-address=${COW_ADDRESS}]`).prop('outerHTML');
    $(`.token_row[data-address=${COW_ADDRESS}]`).remove();
    $(`.token_row[data-address=${WBNB_ADDRESS}]`).after(cowHtml);

    const cashHtml = $(`.token_row[data-address=${CASH_ADDRESS}]`).prop('outerHTML');
    $(`.token_row[data-address=${CASH_ADDRESS}]`).remove();
    $(`.token_row[data-address=${WBNB_ADDRESS}]`).after(cashHtml);
  }
}

$(document).on('click', '.token_row', function () {
  selectToken($(this).data('address'));
});

function selectToken(address) {
  closeModal();
  currentTrade[currentSelectSide] = tokens[address];
  renderSwapInfo();
  getQuote();
}

async function renderInterface() {
  user = Moralis.User.current();
  if (user) {
    document.getElementById("swap_button").disabled = false;
    document.getElementById("connect_wallet_button").hidden = true;
    document.getElementById("logout_button").hidden = false;
    $('#address').text(shortenAddress(user.get("ethAddress")));
    $('#address').show(user.get("ethAddress"));
    await enabledMoralisWeb3();
    const networkId = await web3.eth.net.getId();
    if (networkId != TESTNET_ID) {
      $('.info-toast-container .info-body').html('Please switch to Binance Smart Chain Wallet');
      $('.info-toast-container').css("z-index", "1");
      $('.info-toast-container .toast').toast('show');
      logOut();
    } else {
      await getBalances();
      let reference = await getReference();
      if (!reference && window.localStorage.getItem('reference')) {
        const results = await Moralis.Cloud.run("setReference", { address: user.get("ethAddress"), reference: window.localStorage.getItem('reference') });
        if (results.status == 'success') {
          window.localStorage.setItem('reference', results.reference);
        } else {
          window.localStorage.removeItem('reference');
        }
      }
    }
  } else {
    document.getElementById("swap_button").disabled = true;
    document.getElementById("connect_wallet_button").hidden = false;
    document.getElementById("logout_button").hidden = true;
    $('#address').text('');
    $('#address').hide();
  }
}

async function getReference() {
  const results = await Moralis.Cloud.run("getReference", { address: user.get("ethAddress") });
  if (results.status == 'success') {
    const reference = results.reference;

    return reference;
  }

  return '';
}

function filterTokens() {
  const keyword = $('#token_search_input').val();
  const filteredTokens = Object.keys(tokens)
    .filter(key => (key === keyword || tokens[key].symbol.toLowerCase().includes(keyword.toLowerCase())))
    .reduce((obj, key) => {
      obj[key] = tokens[key];
      return obj;
    }, {});
  showTokensList(filteredTokens);
}

function renderSwapInfo() {
  if (currentTrade.from) {
    document.getElementById("from_token_img").src = currentTrade.from.logoURI;
    document.getElementById("from_token_text").innerHTML = currentTrade.from.symbol;
    tokenInBalance = 0;
    if (balances[currentTrade.from.address] !== undefined) {
      tokenInBalance = balances[currentTrade.from.address].balance / (10 ** balances[currentTrade.from.address].decimals) || 0;
    }
    tokenInBalance = Number(tokenInBalance.toFixed(DECIMALS));
    $('#token_in_balance').text(`${formatNumber(tokenInBalance)} ${currentTrade.from.symbol}`);
  } else {
    $('#from_token_select').html('<img class="token_image" id="from_token_img"> <span id="from_token_text"></span>');
    $('#token_in_balance').text('0.00');
  }

  if (currentTrade.to) {
    document.getElementById("to_token_img").src = currentTrade.to.logoURI;
    document.getElementById("to_token_text").innerHTML = currentTrade.to.symbol;
    let tokenOutBalance = 0;
    if (balances[currentTrade.to.address] !== undefined) {
      tokenOutBalance = balances[currentTrade.to.address].balance / (10 ** balances[currentTrade.to.address].decimals) || 0;
    }
    tokenOutBalance = Number(tokenOutBalance.toFixed(DECIMALS));
    $('#token_out_balance').text(`${formatNumber(tokenOutBalance)} ${currentTrade.to.symbol}`);
  } else {
    $('#to_token_select').html('<img class="token_image" id="to_token_img"> <span id="to_token_text"></span>');
    $('#token_out_balance').text('0.00');
  }
  $('#from_amount').val(formatNumber(Number(fromAmount.toFixed(DECIMALS))));
  $('#to_amount').val(formatNumber(Number(toAmount.toFixed(DECIMALS))));
}

async function updateTokenBalance() {
  await getBalances();
  renderSwapInfo();
}

async function getBalances() {
  const options = { chain: networks[TESTNET_ID] };
  const nativeBalance = await Moralis.Web3API.account.getNativeBalance(options);
  balances[NATIVE_ADDRESS] = Object.assign({}, tokens[NATIVE_ADDRESS]);
  balances[NATIVE_ADDRESS].balance = nativeBalance.balance;
  const tokenBalances = await Moralis.Web3API.account.getTokenBalances(options);
  for (let tokenBalance of tokenBalances) {
    balances[tokenBalance.token_address] = Object.assign({}, tokens[tokenBalance.token_address]);
    balances[tokenBalance.token_address].balance = tokenBalance.balance;
  }
}

function shortenAddress(address) {
  return address.substring(0, 6) + '...' + address.substring(address.length - 5, address.length);
}

async function connectWallet(provider) {
  $('#wallets_modal').modal('hide');
  if (!user) {
    switch (provider) {
      case 'metamask':
        user = await Moralis.authenticate();
        window.localStorage.setItem('provider', 'metamask');
        break;
      case 'trustwallet':
        user = await Moralis.authenticate();
        window.localStorage.setItem('provider', 'trustwallet');
        break;
      case 'walletconnect':
        user = await Moralis.authenticate({ provider: provider });
        window.localStorage.setItem('provider', 'walletconnect');
        break;
      default:
        break;
    }
  }
  await renderInterface();
  renderSwapInfo();
}

async function enabledMoralisWeb3() {
  const provider = window.localStorage.getItem('provider');
  switch (provider) {
    case 'walletconnect':
      web3 = await Moralis.enableWeb3({ provider: provider });
      break;
    default:
      web3 = await Moralis.enableWeb3();
      break;
  }
}

async function logOut() {
  await Moralis.User.logOut();
  window.localStorage.removeItem('provider');
  window.localStorage.removeItem('reference');
  reset();
  await renderInterface();
  renderSwapInfo();
}

function reset() {
  currentTrade = { from: tokens[NATIVE_ADDRESS], to: tokens[CASH_ADDRESS] };
  currentSelectSide = null;
  balances = {};
  tokenInBalance = 0.0;
  fromAmount = 0.00;
  toAmount = 0.00
  isFromAmountInput = true;
}

function openModal(side) {
  currentSelectSide = side;
  document.getElementById("token_modal").style.display = "block";
}
function closeModal() {
  document.getElementById("token_modal").style.display = "none";
}

async function getQuote() {
  if (isFromAmountInput) {
    const amount = parseFloat($('#from_amount').val());
    fromAmount = isNaN(amount) ? 0.00 : amount;
    if (!currentTrade.from || !currentTrade.to || fromAmount == 0) {
      $('#gas_estimate').text('0.00 BNB');
      toAmount = 0.00;
      $('#to_amount').val('0.00');
      return;
    }
    $('#gas_estimate').text("calculating...");
    toAmount = 0.00;
    $('#to_amount').val('0.00');

    // const quote = await dex.quote({
    //     chain: 'bsc testnet', // The blockchain you want to use (eth/bsc/polygon)
    //     fromTokenAddress: currentTrade.from.address, // The token you want to swap
    //     toTokenAddress: currentTrade.to.address, // The token you want to receive
    //     amount: Moralis.Units.Token(fromAmount, currentTrade.from.decimals).toString(),
    // });
    const quote = await $.get(API_1INCH_BASE + `quote?fromTokenAddress=${currentTrade.from.address}&toTokenAddress=${currentTrade.to.address}&amount=${Moralis.Units.Token(fromAmount, currentTrade.from.decimals).toString()}&protocols=PANCAKESWAP_V2`);

    const estmatedGasFee = quote.estimatedGas * GAS_PRICE / 10 ** 9;
    $('#gas_estimate').text(Number(estmatedGasFee.toFixed(DECIMALS)) + ' BNB');
    toAmount = quote.toTokenAmount / 10 ** currentTrade.to.decimals;
    $('#to_amount').val(formatNumber(Number(toAmount.toFixed(DECIMALS))));
  } else {
    const amount = parseFloat($('#to_amount').val());
    toAmount = isNaN(amount) ? 0.00 : amount;
    if (!currentTrade.from || !currentTrade.to || toAmount == 0) {
      $('#gas_estimate').text('0.00 BNB');
      fromAmount = 0.00;
      $('#from_amount').val('0.00');
      return;
    }
    $('#gas_estimate').text("calculating...");
    fromAmount = 0.00;
    $('#from_amount').val('0.00');

    // const quote = await dex.quote({
    //     chain: 'bsc testnet', // The blockchain you want to use (eth/bsc/polygon)
    //     fromTokenAddress: currentTrade.from.address, // The token you want to swap
    //     toTokenAddress: currentTrade.to.address, // The token you want to receive
    //     amount: Moralis.Units.Token(1, currentTrade.from.decimals).toString(),
    // });
    const quote = await $.get(API_1INCH_BASE + `quote?fromTokenAddress=${currentTrade.from.address}&toTokenAddress=${currentTrade.to.address}&amount=${Moralis.Units.Token(1, currentTrade.from.decimals).toString()}&protocols=PANCAKESWAP_V2`);
    const estmatedGasFee = quote.estimatedGas * GAS_PRICE / 10 ** 9;
    $('#gas_estimate').text(Number(estmatedGasFee.toFixed(DECIMALS)) + ' BNB');
    fromAmount = toAmount / (quote.toTokenAmount / 10 ** currentTrade.to.decimals);
    $('#from_amount').val(formatNumber(Number(fromAmount.toFixed(DECIMALS))));
  }
}

async function trySwap() {
  try {
    let address = Moralis.User.current().get("ethAddress");
    if (currentTrade.from.symbol !== "ETH") {
      const allowance = await dex.hasAllowance({
        chain: 'bsc', // The blockchain you want to use (eth/bsc/polygon)
        fromTokenAddress: currentTrade.from.address, // The token you want to swap
        fromAddress: address, // Your wallet address
        amount: Moralis.Units.Token(fromAmount, currentTrade.from.decimals).toString(),
      })
      if (!allowance) {
        await dex.approve({
          chain: 'bsc', // The blockchain you want to use (eth/bsc/polygon)
          tokenAddress: currentTrade.from.address, // The token you want to swap
          fromAddress: address, // Your wallet address
        });
      }
    }

    $('#swap_button').text('Swapping...');
    $('#swap_button').prop('disabled', true);
    let receipt = await dex.swap({
      chain: 'bsc', // The blockchain you want to use (eth/bsc/polygon)
      fromTokenAddress: currentTrade.from.address, // The token you want to swap
      toTokenAddress: currentTrade.to.address, // The token you want to receive
      amount: Moralis.Units.Token(fromAmount, currentTrade.from.decimals).toString(),
      fromAddress: address, // Your wallet address
      slippage: Number($('#slippage').text()),
    });
    // const receipt = await $.get(API_1INCH_BASE + `swap?fromAddress=${user.get('ethAddress')}&fromTokenAddress=${currentTrade.from.address}&toTokenAddress=${currentTrade.to.address}&amount=${Moralis.Units.Token(1, currentTrade.from.decimals).toString()}&slippage=${Number($('#slippage').text())}&protocols=PANCAKESWAP_V2`);
    if (receipt.transactionHash) {
      Moralis.Cloud.run("rewardReference", { address: user.get("ethAddress"), transactionHash: receipt.transactionHash });

      $('.receipt-body').text(`Swap ${Number(fromAmount.toFixed(DECIMALS))} ${currentTrade.from.symbol} for ${Number(toAmount.toFixed(DECIMALS))} ${currentTrade.to.symbol}`);
      $('.receipt-link a').prop('href', 'https://testnet.bscscan.com/' + receipt.transactionHash);
      $('#swap_button').text('Begin Swap');
      $('#swap_button').prop('disabled', false);
      await updateTokenBalance();
      $('.toast-container').css("z-index", "1");
      $('.toast-container .toast').toast('show');
    } else {
      throw new Error(receipt.message);
    }
  } catch (error) {
    let errorMessage = error.message;
    if (errorMessage.includes('Not enough')) {
      errorMessage = 'Not enough ' + currentTrade.from.symbol;
    }

    $('.info-toast-container .info-body').html(errorMessage);
    $('.info-toast-container').css("z-index", "1");
    $('.info-toast-container .toast').toast('show');
    $('#swap_button').text('Begin Swap');
    $('#swap_button').prop('disabled', false);
  }
}

function formatNumber(number) {
  if (!isNaN(number)) {
    number = number.toString();
  }
  const dotPosition = number.indexOf(".");
  if (dotPosition === -1) {
    number = number + ".00";
  } else if (dotPosition === number.length - 2) {
    number = number + "0";
  }

  return number;
}

function exchangeToken() {
  const currentTradeTo = currentTrade.to ? Object.assign({}, currentTrade.to) : null;
  if (currentTrade.from) {
    currentTrade.to = Object.assign({}, currentTrade.from);
  } else {
    delete currentTrade['to'];
  }
  if (currentTradeTo) {
    currentTrade.from = currentTradeTo;
  } else {
    delete currentTrade['from'];
  }
  if (isFromAmountInput) {
    $('#to_amount').val(formatNumber(fromAmount));
  } else {
    $('#from_amount').val(formatNumber(toAmount));
  }
  isFromAmountInput = !isFromAmountInput;
  getQuote();
  renderSwapInfo();
}

$('.btn-max').on('click', function () {
  $('#from_amount').val(tokenInBalance);
  $('#from_amount').keyup();
});

init();

document.getElementById("modal_close").onclick = closeModal;
document.getElementById("from_token_select").onclick = (() => { openModal("from") });
document.getElementById("to_token_select").onclick = (() => { openModal("to") });
document.getElementById("logout_button").onclick = logOut;
document.getElementById("btn_exchange").onclick = exchangeToken;
document.getElementById("from_amount").onkeyup = () => {
  isFromAmountInput = true;
  getQuote();
};
document.getElementById("to_amount").onkeyup = () => {
  isFromAmountInput = false;
  getQuote();
};
document.getElementById("swap_button").onclick = trySwap;
document.getElementById("token_search_input").onkeyup = filterTokens;
