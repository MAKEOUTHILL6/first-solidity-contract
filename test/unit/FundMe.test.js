const { deployments, ethers, getNamedAccounts } = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains } = require("../../helper-hardhat-config");


developmentChains.includes(network.name)
    ? describe("FundMe", () => {
          let fundMe;
          let deployer;
          let mockV3Aggregator;
          const sendValue = ethers.utils.parseEther("1");
          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              fundMe = await ethers.getContract("FundMe", deployer);
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              );
          });

          describe("constructor", () => {
              it("sets the aggregator addresses correctly", async () => {
                  const res = await fundMe.getPriceFeed();
                  assert.equal(res, mockV3Aggregator.address);
              });
          });

          describe("fund", () => {
              it("Fails if invalid eth send", async () => {
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "You need to spend more ETH!"
                  );
              });

              // run only this test => npx hardhat test --grep "amount funded"
              it("Updated the amount funded data structure", async () => {
                  await fundMe.fund({ value: sendValue });
                  const res = await fundMe.getAddressToAmountFunded(deployer);
                  assert.equal(res.toString(), sendValue.toString());
              });

              it("Adds funder to array of funders", async () => {
                  await fundMe.fund({ value: sendValue });
                  const funder = await fundMe.getFunder(0);
                  assert.equal(funder, deployer);
              });
          });

          describe("withdraw", () => {
              beforeEach(async () => {
                  await fundMe.fund({ value: sendValue });
              });

              it("Can withdraw ETH from a single funder", async () => {
                  const startingFundBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  );
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer);

                  const transactionRes = await fundMe.withdraw();
                  const transactionReceipt = await transactionRes.wait(1);

                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  let gasCost = gasUsed.mul(effectiveGasPrice);

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  );
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer);

                  assert.equal(endingFundMeBalance, 0);
                  assert.equal(
                      startingFundBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerBalance.add(gasCost).toString()
                  );
              });
          });

          it("Allows us to withdraw with multiple funders", async () => {
              const accounts = await ethers.getSigners();
              for (let i = 1; i < 6; i++) {
                  const fundMeConnectedContract = await fundMe.connect(
                      accounts[i]
                  );
                  await fundMeConnectedContract.fund({ value: sendValue });
              }

              const startingFundBalance = await fundMe.provider.getBalance(
                  fundMe.address
              );
              const startingDeployerBalance = await fundMe.provider.getBalance(
                  deployer
              );

              const transactionResponse = await fundMe.withdraw();
              const transactionReceipt = await transactionResponse.wait(1);
              const { gasUsed, effectiveGasPrice } = transactionReceipt;
              let gasCost = gasUsed.mul(effectiveGasPrice);

              const endingFundMeBalance = await fundMe.provider.getBalance(
                  fundMe.address
              );
              const endingDeployerBalance = await fundMe.provider.getBalance(
                  deployer
              );

              assert.equal(endingFundMeBalance, 0);
              assert.equal(
                  startingFundBalance.add(startingDeployerBalance).toString(),
                  endingDeployerBalance.add(gasCost).toString()
              );

              await expect(fundMe.getFunder(0)).to.be.reverted;

              for (i = 1; i < 6; i++) {
                  assert.equal(
                      await fundMe.getAddressToAmountFunded(
                          accounts[i].address
                      ),
                      0
                  );
              }
          });

          it("Only allows owner to withdraw", async () => {
              const accounts = await ethers.getSigners();
              const attacker = accounts[1];
              const attackerConnectedContract = await fundMe.connect(attacker);
              await expect(attackerConnectedContract.withdraw()).to.be.reverted;
          });
      })
    : describe.skip;
