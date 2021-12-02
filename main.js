Moralis.initialize("KoryTww3CCjFtrsUa8ze6ZonbBR6Dhe74zP9izsE"); // Application id from moralis.io
Moralis.serverURL = "https://yn0vczpsv6k3.usemoralis.com:2053/server"; //Server url from moralis.io


let currentTrade = {};
let currentSelectSide;
let tokens;
let currentUser;



async function init() {
    await Moralis.initPlugins();
    await Moralis.enable();
    await listAvailableTokens();


    if(currentUser){
        currentUser = await Moralis.Web3.authenticate();
        document.getElementById("swap_button").disabled = false;
        
    }

}




async function listAvailableTokens(){
    const result = await Moralis.Plugins.oneInch.getSupportedTokens({
        chain: 'bsc', 
      });
      console.log(result);
      tokens = result.tokens;
      let parent = document.getElementById("token_list");
      for( const address in tokens ){ //obj w/ keys & values 
          let token = tokens[address];
          let div = document.createElement("div");
          div.setAttribute("data-address", address)
          div.className = "token_row";
          let html=`
          <img  class="token_list_img" src="${token.logoURI}" >
          <span class="token_list_text">${token.symbol}<span>
          `
          div.innerHTML = html;
          div.onclick = (()=>{selectToken(address)});
          parent.appendChild(div);
      } 
}




function selectToken(address){
    closeModal()
    console.log(tokens)

    console.log(address);
    currentTrade[currentSelectSide] = tokens[address];
    console.log(currentTrade);
    renderInterface();
    getQuote();
}




function renderInterface(){
    if(currentTrade.from){
        document.getElementById("from_token_img").src = currentTrade.from.logoURI;
        document.getElementById("from_token_ticker").innerHTML = currentTrade.from.symbol;
    }
    
    if(currentTrade.to){
        document.getElementById("to_token_img").src = currentTrade.to.logoURI;
        document.getElementById("to_token_ticker").innerHTML = currentTrade.to.symbol;
    }
}




async function login() {
    let logged = "Connected";
    try {
        currentUser = Moralis.User.current();
        if(!currentUser){
            currentUser = await Moralis.Web3.authenticate();
            
        }
        document.getElementById("swap_button").disabled = false;
        document.getElementById("login_button").textContent = logged;
        
    } catch (error) {
        console.log(error);
    }
}



function openModal(side){
    currentSelectSide = side;
    document.getElementById("token_modal").style.display = "block";
}



function closeModal(){
    document.getElementById("token_modal").style.display = "none";
}



async function getQuote(){
    if(!currentTrade.from || !currentTrade.to || document.getElementById("from_amount").value) return;

    let amount = Number( document.getElementById("from_amount").value * 10**currentTrade.from.decimals );

    const quote = await Moralis.Plugins.oneInch.quote({
        chain: 'bsc', 
        fromTokenAddress: currentTrade.from.address, // The token you want to swap
        toTokenAddress: currentTrade.to.address, // The token you want to receive
        amount: amount,
    })
    console.log(quote);
    document.getElementById("estimated_gas").innerHTML = quote.estimatedGas;
    document.getElementById("to_amount").value = quote.toTokenAmount / (10**quote.toToken.decimals) ;
}



async function trySwap(){
    let address = Moralis.User. current().get("ethAddress");
    let amount = Number( document.getElementById("from_amount").value * 10**currentTrade.from.decimals );

    if(currentTrade.from.symbol !== "BNB"){
        const allowance = await Moralis.Plugins.oneInch.hasAllowance({
            chain: 'bsc', 
            fromTokenAddress: currentTrade.from.address, 
            fromAddress: address, 
            amount: amount,
        }) 

        console.log(allowance);

        if(!allowance){
            await Moralis.Plugins.oneInch.approve({
                chain: 'bsc', 
                tokenAddress: currentTrade.from.address, 
                fromAddress: address,
              });
        }
    }
    let receipt = await doSwap(address, amount);
    alert("Swap Complete")

}

async function doSwap(userAddress, amount){
    
    return Moralis.Plugins.oneInch.swap({
        chain: 'bsc', 
        fromTokenAddress: currentTrade.from.address,
        toTokenAddress: currentTrade.to.address,
        amount: amount,
        fromAddress: userAddress,
        slippage: 1,
      });

}

init()

document.getElementById("close_modal").onclick = closeModal
document.getElementById("from_token_select").onclick = (()=>{openModal("from")});
document.getElementById("to_token_select").onclick = (()=>{openModal("to")});
document.getElementById("login_button").onclick = login;
document.getElementById("from_amount").onblur = getQuote;
document.getElementById("swap_button").onclick = trySwap;
