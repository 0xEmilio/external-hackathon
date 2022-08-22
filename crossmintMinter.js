/*
 Single File Mintoooooor. 

 What the heck is this thing? One of the many ways crossmint can make your project happen.

 Many NFT creators have used HashLips at one point to mash layers and generate metadata. The issue comes later when its time to create contracts, pay for them and figure out dapps and listing them, etc.etc.

 This tool/script addresses these issues for the NFT enthusiast that doesnt have tons of coding experience. 

 Flow:
 1. Configure relevant settings
 2. Point the *_PATH variables to the hashlips generated data
 3. Run the script to mint them all to a single wallet.
 -> In the future when eth mainnet (or testnets) are supported, list them automatically on OpenSea (or crossmint?)

 What are some of the specifics?
 - You get to decide if you use the "image" field in the metadata or just upload straight from the local folder into ipfs. By default we do local - other option is a little more advanced.

 *NOTE*
  . This script and companion script are made to run on testnets. 
  . This script is given as is and would need to be refactored for mainnet, we are not responsible for loss of funds in this event.

  EDIT: UPON finishing this I realized mumbai is not supported on opensea-js (autolisting) BUT it is supported for ETH and testnets.
  --- this can still be used then.

*/

// requests
const fetch = require("node-fetch");
const { Headers } = fetch;
// image to image url
const cloudinary = require("cloudinary").v2;
// opensea stuff
const opensea = require("opensea-js");
const { WyvernSchemaName } = require('opensea-js/lib/types');
const OpenSeaPort = opensea.OpenSeaPort;

// == EDIT THESE THINGS ===============
// API tings
let API_ROUTE = "https://staging.crossmint.io/api/2022-06-09/";
let API_KEY = "crossmint api key";
let API_PROJECT_ID = "crossmint project id";

// Project tings
let PROJECT_NAME = "Crossmint Hackathonoooooor";
let PROJECT_DESCRIPTION = "1k NFT's minted to the same wallet.";
let PROJECT_SIZE = 9;
let PROJECT_OWNER_ADDR = "owner address"; // will mint them all to this address

// Setup tings - Metadata path
let METADATA_PATH = "path/to/your/metadata/json";

// Metadata image ignoring flag thingy, let crossmint handle IPFS stuff
// true if you dont have image url's for your hashlips art metadata (default is true)
let IGNORE_METADATA_IMAGE_URL = true // if true, fill out bottom 2
let IMAGES_PATH = "path/to/your/images";
let IMAGES_EXT= ".png";
cloudinary.config({ 
    cloud_name: 'cloudinary cloud name', 
    api_key: 'cloudinary key', 
    api_secret: 'cloudinary secret' 
  });

/* auto-list collection on opensea?
   unfortunately polygon-mumbai is not supported yet.
   this is some freebie code of an actual production OpenSea API snippet
   This would work on rikeby/mainnet eth */
   let LIST_TO_OPENSEA = true;
   const NODE_API_KEY = "node api key goes here... (infura)" 
   const OS_API_KEY = "" // not needed for testnet, needed for mainnet 
   const MNEMONIC = "seed goes here...."



// == STOP TOUCHING THINGS PAST THIS POINT ===========================================

// Main procedure for minting entire collection to single wallet
async function runProcedure(){
    // create the collection
    console.log("Running script, going to create the collection first.")
    let collection = await createCollection();
    console.log("Your collection ID is: " + collection.id)
    for (let ii = 1; ii <= PROJECT_SIZE; ii++){
        // get file and mint it, generate image if on buffer
        console.log(`minting tokenId ${ii} to collection ID ${collection.id}`);
        let metajson = require(METADATA_PATH + `${ii}.json`);
        let sendMint = await mint(collection.id, metajson, ii);
        // check for success
        let check = await checkStatus(sendMint.id, collection.id);
        while (check.onChain.status == "pending"){
            await new Promise(r => setTimeout(r, 2000));
            check = await checkStatus(sendMint.id, collection.id);
        }
        if (check.onChain.status = "success"){
            console.log(`minted token ${ii} || OpenSea: https://testnets.opensea.io/assets/mumbai/${sendMint.onChain.contractAddress}/${ii}`);
            /*
            if (LIST_TO_OPENSEA){
                console.log(`listing tokenId ${ii}`);
                let listing = await openlist(check.onChain.contractAddress, check.onChain.owner, check.onChain.tokenId);
                if (listing){
                    console.log(`successful listing of tokenId ${ii}`);
                }
                else {
                    console.log(`could not list tokenId ${ii}`);
                }
            }*/
        }
        else {
            console.log(`failed to mint token ${ii}`);
        }
    }
}


// Crossmint Connections =====
// no abstraction so users can see details of calls, ideally abstract this into one factory function

// create a collection
async function createCollection(){
    const reqHeader = new Headers();
    reqHeader.append("x-client-secret", API_KEY);
    reqHeader.append("x-project-id", API_PROJECT_ID);
    reqHeader.append("Content-Type", "application/json");

    const reqBody = JSON.stringify({
        "chain": "polygon",
        "metadata": {
            "name": PROJECT_NAME,
            "description": PROJECT_DESCRIPTION
        }
    });

    var requestOptions = {
        method: 'POST',
        headers: reqHeader,
        body: reqBody,
        redirect: 'follow'
    };

    let creation_result;
    await fetch(API_ROUTE + "collections", requestOptions)
        .then(response => response.json())
        .then(result => creation_result = result)
        .catch(error => console.log('error', error));
    return creation_result;
}

// mint an NFT
async function mint(collectionID, data, tokenId){
    const reqHeader = new Headers();
    reqHeader.append("x-client-secret", API_KEY);
    reqHeader.append("x-project-id", API_PROJECT_ID);
    reqHeader.append("Content-Type", "application/json");
    // take into account if we are using local image batch or from metadata
    // THERE MUST BE SAME AMOUNT OF PICTURES AS METADATA - we are not checking for this here.
    if (IGNORE_METADATA_IMAGE_URL){
        data.image = await getImageURL(IMAGES_PATH + tokenId + IMAGES_EXT, tokenId);
    };

   const reqBody = JSON.stringify({
        "mainnet": false,
        "metadata": {
            "name": data.name,
            "description": data.description,
            "image": data.image,
            "dna": data.dna,
            "edition": data.edition,
            "date": data.date,
            "attributes": data.attributes
        },
        "recipient": `poly:${PROJECT_OWNER_ADDR}`
    });

    var requestOptions = {
        method: 'PUT',
        headers: reqHeader,
        body: reqBody,
        redirect: 'follow'
      };

      let mint_result;
      await fetch(API_ROUTE + `collections/${collectionID}/nfts/${tokenId}`, requestOptions)
        .then(response => response.json())
        .then(result => mint_result = result)
        .catch(error => console.log('error', error));
    return mint_result;
}

// is minting done?
async function checkStatus(tokenId, contractAddr){
    const reqHeader = new Headers();
    reqHeader.append("x-client-secret", API_KEY);
    reqHeader.append("x-project-id", API_PROJECT_ID);
    reqHeader.append("Content-Type", "application/json");

    const requestOptions = {
        method: 'GET',
        headers: reqHeader,
        redirect: 'follow'
    };

    let check_result;
    await fetch(`${API_ROUTE}/collections/${contractAddr}/nfts/${tokenId}`, requestOptions)
    .then(response => response.json())
    .then(result => check_result = result)
    .catch(error => console.log('error', error));
    return check_result;
}

// cloudinary for image api stuff
async function getImageURL(path, tokenid){

    let res = await cloudinary.uploader.upload(path,
     { resource_type: "image",  public_id: tokenid }, 
     function(error, result) {return result; });
     return (res.url);
   }

/* opensea lister

please never share your seed phrase. 
in this case it will be needed for the opensea api to communicate with eth mainnet or testnet.

this snippet is purely educational since it can't be used with mumbai.
*/

async function openlist(contract, owner, token_number) {
    const HDWalletProvider = require("@truffle/hdwallet-provider");
    const provider = new HDWalletProvider({
    mnemonic: {
        phrase: MNEMONIC
    },
    providerOrUrl: "https://rinkeby.infura.io/v3/" + NODE_API_KEY
    });

    const seaport = new OpenSeaPort(provider, {
    networkName: opensea.Network.Rinkeby,
    apiKey: OS_API_KEY,
    });

    // simple fixed-price sale of an item - instant sell 2 month expiration
    console.log("Auctioning an item for a fixed price...");
    try {
        const fixedPriceSellOrder = await seaport.createSellOrder({
          asset: {
            tokenId: token_number,
            tokenAddress: contract,
            schemaName: WyvernSchemaName.ERC721
          },
          startAmount: 0.3, //ETH cost
          accountAddress: owner,
        });
      console.log(` -> Successfully created a fixed-price sell order! ${token_number} | ${fixedPriceSellOrder.orderHash}`);
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

runProcedure();
