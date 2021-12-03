Moralis.Cloud.define("getAbi", async (request) => {
  try {
    const contractAbi = Moralis.Object.extend("Abi");
    const contractQuery = new Moralis.Query(contractAbi);
    contractQuery.equalTo("name", request.params.name);
    const contract = await contractQuery.first();
    return {
      status: "success",
      abi: contract.attributes.abi,
      address: contract.attributes.address,
    };
  } catch (error) {
    return { status: "error", message: error };
  }
});
