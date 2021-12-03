Moralis.Cloud.define("getTotalStaked", async (request) => {
  const ContractAbi = Moralis.Object.extend("Abi");
  const contractQuery = new Moralis.Query(ContractAbi);
  contractQuery.equalTo("name", "staking");
  const stakingContract = await contractQuery.first();
  const web3 = Moralis.web3ByChain("0x38"); // BSC testnet 0x61, 0x38 for BSC mainet
  const contract = new web3.eth.Contract(JSON.parse(stakingContract.attributes.abi), stakingContract.attributes.address);
  const totalStaked = await contract.methods[
    "getTotalStaked"
  ]().call();
  
  return { status: "success", totalStaked: totalStaked };
});

Moralis.Cloud.define("getInterestRate", async (request) => {
  const ContractAbi = Moralis.Object.extend("Abi");
  const contractQuery = new Moralis.Query(ContractAbi);
  contractQuery.equalTo("name", "staking");
  const stakingContract = await contractQuery.first();
  const web3 = Moralis.web3ByChain("0x38"); // BSC testnet 0x61, 0x38 for BSC mainet
  const contract = new web3.eth.Contract(JSON.parse(stakingContract.attributes.abi), stakingContract.attributes.address);
  const interestRate = await contract.methods["termToInterestRate"](
    request.params.stakingTerm
  ).call();
  
  return { status: "success", interestRate: interestRate };
});