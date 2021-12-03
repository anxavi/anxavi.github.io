Moralis.Cloud.define("getRef", async (request) => {
  const User = Moralis.Object.extend("User");
  const query = new Moralis.Query(User);
  query.equalTo("ethAddress", request.params.address);
  const user = await query.first({ useMasterKey: true });
  if (user) {
    if (user.attributes.ref) {
      return { "status": "success", "ref": user.attributes.ref };
    } else {
      const refsQuery = new Moralis.Query(User);
      refsQuery.notEqualTo("ref", null);
      const refs = [];
      const users = await refsQuery.find({ useMasterKey: true });
      for (let i = 0; i < users.length; i++) {
        refs.push(users[i].attributes.ref);
      }
      do {
        const ref = makeid(REF_LENGTH);
        if (!refs.includes(ref)) {
          user.set('ref', ref);
          user.save(null, { useMasterKey: true });

          return { "status": "success", "ref": ref };
        }
      } while (true);
    }
  }

  return { "status": "error", "message": "User not found" };
});

Moralis.Cloud.define("getReference", async (request) => {
  const User = Moralis.Object.extend("User");
  const query = new Moralis.Query(User);
  query.equalTo("ethAddress", request.params.address);
  const user = await query.first({ useMasterKey: true });
  if (user && user.attributes.reference) {
    return { "status": "success", "reference": user.attributes.reference };
  }

  return { "status": "success", "reference": null };
});

Moralis.Cloud.define("setReference", async (request) => {
  if (!request.params.reference) {
    return { "status": "error", "message": "Empty reference" };
  }
  const User = Moralis.Object.extend("User");
  const query = new Moralis.Query(User);
  query.equalTo("ethAddress", request.params.address);
  const user = await query.first({ useMasterKey: true });
  if (user) {
    if (user.attributes.reference) {
      // return current reference in the DB, no matter what the value of the reference param is
      return { "status": "success", "reference": user.attributes.reference };
    }
    // check there is a ref value in the DB equals to the reference param, if yes, we will update this value. Otherwise, we will return error
    // we also prevent user to set himeself as the reference
    const refsQuery = new Moralis.Query(User);
    refsQuery.equalTo("ref", request.params.reference);
    const referenceUser = await refsQuery.first({ useMasterKey: true });
    if (referenceUser && request.params.reference != user.attributes.ref) {
      user.set('reference', request.params.reference);
      user.save(null, { useMasterKey: true });

      return { "status": "success", "reference": request.params.reference };
    }

    return { "status": "error", "message": "Invalid reference" };
  }

  return { "status": "error", "message": "User not found" };
});

Moralis.Cloud.define("getReward", async (request) => {
  const User = Moralis.Object.extend("User");
  let query = new Moralis.Query(User);
  query.equalTo("ethAddress", request.params.address);
  const user = await query.first({ useMasterKey: true });
  if (user) {
    const RewardTransaction = Moralis.Object.extend("RewardTransaction");
    query = new Moralis.Query(RewardTransaction);
    const pipeline = [
      { match: { ref: user.attributes.ref } },
      { sort: { createdAt: -1 } },
      { limit: 5 }
    ];
    const rewardTransactions = await query.aggregate(pipeline);

    return { "status": "success", "reward": user.attributes.reward || 0, "rewardTransactions": rewardTransactions };
  }

  return { "status": "success", "reward": 0, "rewardTransactions": [] };
});

Moralis.Cloud.define("resetReward", async (request) => {
  const User = Moralis.Object.extend("User");
  const query = new Moralis.Query(User);
  query.equalTo("ethAddress", request.params.address);
  const user = await query.first({ useMasterKey: true });
  if (user) {
    user.set("reward", 0);
    user.save(null, { useMasterKey: true });
    return { "status": "success" };
  } else {
    return { "status": "error", "message": "User not found" };
  }
});

Moralis.Cloud.define("rewardReference", async (request) => {
  const User = Moralis.Object.extend("User");
  const RewardTransaction = Moralis.Object.extend("RewardTransaction");
  const query = new Moralis.Query(User);
  const transactionHash = request.params.transactionHash;
  const address = request.params.address;
  query.equalTo("ethAddress", address);
  const user = await query.first({ useMasterKey: true });
  if (user && user.attributes.reference) {
    const referenceQuery = new Moralis.Query(User);
    referenceQuery.equalTo("ref", user.attributes.reference);
    const referenceUser = await referenceQuery.first({ useMasterKey: true });
    if (referenceUser) {
      // first, check the hash exists or not. If yes, return error
      const rewardTransactionQuery = new Moralis.Query(RewardTransaction);
      const transactionHashes = [];
      const rewardTransactions = await rewardTransactionQuery.find();
      for (let i = 0; i < rewardTransactions.length; i++) {
        transactionHashes.push(rewardTransactions[i].attributes.transactionHash);
      }
      if (transactionHashes.includes(transactionHash)) {
        return { "status": "error", "message": "Transaction exists!" };
      }

      const web3 = Moralis.web3ByChain("0x38");
      const transaction = await web3.eth.getTransaction(transactionHash);
      // make sure the from address of the transaction is the same as the user address.
      if (transaction && transaction.from.toLowerCase() === address.toLowerCase()) {
        const block = await web3.eth.getBlock(transaction.blockHash);
        const timeDiff = Math.floor(Date.now() / 1000) - block.timestamp;
        // We will only allow transactions no more than 2 minutes ago
        // for prevent users use old transactions to earn rewards.
        if (timeDiff <= 120) {
          const value = transaction.value;
          if (value > 0) {
            const url = `${API_1INCH_BASE}quote?fromTokenAddress=${NATIVE_ADDRESS}&toTokenAddress=${CASH_ADDRESS}&amount=${value}&protocols=PANCAKESWAP_V2`;
            const response = await Moralis.Cloud.httpRequest({
              "url": url,
              "headers": {
                'method': 'GET',
                'accept': 'application/json'
              }
            });

            if (response.data.toTokenAmount) {
              // reward 0.1% BNB value
              const reward = response.data.toTokenAmount / 1000;
              const updatedReward = (referenceUser.attributes.reward || 0) + reward;
              const updatedTotalReward = (referenceUser.attributes.totalReward || 0) + reward;
              referenceUser.set('reward', updatedReward);
              referenceUser.set('totalReward', updatedTotalReward);
              referenceUser.save(null, { useMasterKey: true });

              // store this tx hash to the RewardTransaction table
              const rewardTransaction = new RewardTransaction();
              rewardTransaction.set('ref', user.attributes.reference);
              rewardTransaction.set('transactionHash', transactionHash);
              rewardTransaction.set('reward', reward);
              await rewardTransaction.save();

              return { "status": "success", "reward": reward, "updatedReward": updatedReward, "updatedTotalReward": updatedTotalReward };
            }
          }
        }
      }
    }

    return { "status": "error", "message": "Reward reference failed!" };
  }

  return { "status": "error", "message": "User not found" };
});

function makeid(length) {
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}
