const fs = require('fs');
const path = require("path");
const Axios = require("axios");
const util = require('util');

const PARALLEL_REQUEST = 100;
const ADDRESS_STRING_LENGTH = 40;

const axios = Axios.create({
  baseURL: 'https://rpc.xinfin.network/',
  headers: {'content-type': 'application/json'},
  timeout: 60000,
})

const writeJsonFile = async (data, outputFilename) => {
  return fs.writeFileSync(
    path.join(__dirname, `output`, `${outputFilename}.json`),
    JSON.stringify(data),
    {encoding:'utf8',flag:'w'}
  );
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const axiosClient = async (config, type) => {
  try {
    const {data, status} = await axios.request(config);
    if (status !== 200) throw new Error('Not 200 response')
    return data;
  } catch (error) {
    console.log(`Failed to get http response from Xinfin for ${type} data, going to sleep and retry!`);
    sleep(5000);
    return await axiosClient(config, type);
  }
}

const convertFieldToInt = (fields, block) => {
  fields.forEach(f => {
    block[f] = parseInt(block[f], 16);
  });
  return block;
}

const getBlockByNumber = async(blockNum) => {
  const config = {
    method: 'POST',
    url: '/getBlockByNumber',
    data: JSON.stringify({"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":[`0x${blockNum}`,true],"id":1})
  }
  const data = await axiosClient(config, 'block');
  const blockJson = convertFieldToInt(['nonce', 'gasUsed', 'difficulty', 'number', 'size', 'timestamp', 'totalDifficulty', 'gasLimit'], data.result);
  // Assign one processor to run the binary go file
  const exec = util.promisify(require('child_process').exec);
  const {stdout, stderr} = await exec(`./blockDecoder '${JSON.stringify(blockJson)}'`);
  
  if (stderr) {
    console.log('Failed to get miner and validator address: ', stderr);
  }
  const reverseEngineeringData = stdout.split('\n');
  return {
    ...blockJson,
    minerAddress: reverseEngineeringData[0].toLowerCase(),
    validatorAddress: reverseEngineeringData[1].toLowerCase(),
    validatorMapping: reverseEngineeringData[2].split(' ').join(",")
  }
}

const getSignersByNumber = async(blockNum) => {
  const config = {
    method: 'POST',
    url: '/getBlockSignersByNumber',
    data: JSON.stringify({"jsonrpc":"2.0","method":"eth_getBlockSignersByNumber","params":[`0x${blockNum}`],"id":1})
  }
  const { result } = await axiosClient(config, 'signer');
  
  return result
}

const gettingBlockData = async (blockNumber) => {
  console.log(`getting block ${blockNumber}`);
  const hexNum = blockNumber.toString(16);
  let orderedMinerList = [];
  let penaltyMiners = [];
  // Block information
  const [{ hash, extraData, number, size, parentHash, transactions, penalties, timestamp, minerAddress, validatorAddress, validatorMapping}, signers] = await Promise.all([getBlockByNumber(hexNum), getSignersByNumber(hexNum)])

  // Check if it's an epoch 0 block
  if (!(number % 900)) {
    // It's an epoch 0 block, we need to decode more data
    orderedMinerList = getMinersListFromExtradata(extraData);
    penaltyMiners = getPenaltiesMinersListFromPenalties(penalties);
  }

  return {
    transactions,
    hash, number, size, timestamp, parentHash, extraData,
    signers,
    numOfSigners: signers.length,
    minerAddress,
    validatorAddress, validatorMapping,
    penaltyMiners,
    orderedMinerList,
    epochNumber: Math.floor(number/900),
    nthBlockInEpoch: number % 900
  }
}

const getPenaltiesMinersListFromPenalties = (penalties) => {
  let masterNodeString = penalties.substring(2, penalties.length); //delete 0x prefix
  const numberOfMiners = Math.floor(masterNodeString.length/40);
  const miners = [];
  for (let index = 0; index < numberOfMiners; index++) {
    miners.push({
      index,
      minerAddress: masterNodeString.substring(0, 40)
    });
    masterNodeString = masterNodeString.substring(40);
  }
  return miners;
}

const getMinersListFromExtradata = (extraData) => {
  let masterNodeString = extraData.substring(66, extraData.length-130);

  const numberOfMiners = Math.floor(masterNodeString.length/40);
  const miners = [];
  for (let index = 0; index < numberOfMiners; index++) {
    miners.push(masterNodeString.substring(0, 40));
    masterNodeString = masterNodeString.substring(40);
  }
  return miners;
}

const main = async (start, end, fileName) => {
  const blocksMap = {};
  const blocks = [];
  
  // Load the very last block for calculating the time to mine
  blocksMap[start - 1] = await gettingBlockData(start - 1);
  // Start batch of PARALLEL_REQUEST
  for (let i = start; i < end; i = i+PARALLEL_REQUEST) {
    const promises = [];
    for (let j = i; j < i+PARALLEL_REQUEST; j++) {
      promises.push(gettingBlockData(j));
    }
    const tenBlocks = await Promise.all(promises);
    tenBlocks.forEach(b => blocksMap[b.number] = b)
  }
  // Re-order object into array and calculate the timeToMine
  for (let index = start; index < end; index++) {
    const currBlock = blocksMap[index];
    const previousBlock = blocksMap[index - 1]
    currBlock.timeToMine = currBlock.timestamp - previousBlock.timestamp;

    blocks.push(currBlock);
  }

  if (blocks.length) {
    try {
      console.log('Writting data')
      await writeJsonFile(blocks, fileName);
    } catch (error) {
      console.log(`Error while trying to write to file`, error);
    }
  }
};

const start = process.env.START || 27307800
const end = process.env.END || 27307800 + PARALLEL_REQUEST
const fileName = process.env.OUTPUTFILE || 'output'
console.log(`Fetching block from ${start} to ${end} and write to in /output/${fileName}.json`)

main(parseInt(start), parseInt(end), fileName).then(() => process.exit()).catch(e => console.log(e));
