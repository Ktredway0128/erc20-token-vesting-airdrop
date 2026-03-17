const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SampleToken", function () {
  let Token,
      token,
      owner,
      addr1,
      addr2;

  // This runs before each test
  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    Token = await ethers.getContractFactory("SampleToken");
    token = await Token.deploy(
      "Sample Token",           // name
      "STK",                    // symbol
      ethers.utils.parseUnits("1000000", 18), // cap
      ethers.utils.parseUnits("100000", 18)   // initial supply
    );
    await token.deployed();
  });

  it("should set the right name, symbol, cap, and initial supply", async function () {
    expect(await token.name()).to.equal("Sample Token");
    expect(await token.symbol()).to.equal("STK");

    expect((await token.cap()).toString()).to.equal(
      ethers.utils.parseUnits("1000000", 18).toString()
    );

    expect((await token.totalSupply()).toString()).to.equal(
      ethers.utils.parseUnits("100000", 18).toString()
    );

    expect((await token.balanceOf(owner.address)).toString()).to.equal(      //// deployer balance after initial Supply
      ethers.utils.parseUnits("100000", 18).toString()
    );
  });

  describe("Transfers", function () {
    it("Owner can transfer tokens to another account", async function () {
      const transferAmount = ethers.utils.parseUnits("1000", 18);
  
      // Owner transfers to addr1
      await expect(token.connect(owner).transfer(addr1.address, transferAmount))
        .to.not.be.reverted;
  
      // Check balances
      const ownerBalance = await token.balanceOf(owner.address);
      const addr1Balance = await token.balanceOf(addr1.address);
  
      expect(ownerBalance.toString()).to.equal(
        ethers.utils.parseUnits("99000", 18).toString() // 100000 initial - 1000 transferred
      );
      expect(addr1Balance.toString()).to.equal(
        transferAmount.toString()
      );
  
      console.log(`Transferred ${ethers.utils.formatUnits(transferAmount, 18)} tokens from owner to addr1`);
    });
  });

  describe("Minting", function () {
    it("Owner with MINTER_ROLE can mint and emit TokensMinted", async function () {
      const mintAmount = ethers.utils.parseUnits("5000", 18);
  
      // Mint tokens and check that TokensMinted event is emitted
      await expect(token.connect(owner).mint(addr1.address, mintAmount))
        .to.emit(token, "TokensMinted")
        .withArgs(addr1.address, mintAmount);

        // console log to show/prove event happened
        console.log("Minted", ethers.utils.formatUnits(mintAmount, 18), "tokens to", addr1.address);
  
      // Check that the balance updated correctly
      const balance = await token.balanceOf(addr1.address);
      expect(balance.toString()).to.equal(mintAmount.toString());
    });
  
    it("Non-MINTER_ROLE cannot mint", async function () {
      const mintAmount = ethers.utils.parseUnits("5000", 18);
      const minterRole = await token.MINTER_ROLE();
  
      // Non-MINTER_ROLE should revert with correct reason
      await expect(
        token.connect(addr1).mint(addr1.address, mintAmount)
      ).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${minterRole}`
      );
    });

    // @notice Verifies that minting to the zero address reverts with a clear error message
    it("Cannot mint to zero address", async function () {
      const mintAmount = ethers.utils.parseUnits("1000", 18);
    
      await expect(
        token.connect(owner).mint(ethers.constants.AddressZero, mintAmount)
      ).to.be.revertedWith("Cannot mint to zero address");
    });
  });

  describe("Pausing", function () {
    it("Owner with PAUSER_ROLE can pause and emit TokensPaused", async function () {

      // Now test that TokenPaused event is emitted
      await expect(token.connect(owner).pause())
        .to.emit(token, "TokenPaused")
        .withArgs(owner.address);

        // Show that its been paused and by what address
        console.log("Token paused by", owner.address);
  
      // Optional: check that transfers are actually paused
      await expect(
        token.connect(owner).transfer(addr1.address, 1)
      ).to.be.revertedWith("ERC20Pausable: token transfer while paused");
    });
  
    it("Owner with PAUSER_ROLE can unpause", async function () {
      // First pause the token
      await token.connect(owner).pause();
  
      await expect(token.connect(owner).unpause())
        .to.emit(token, "TokenUnpaused")
        .withArgs(owner.address);

        // Show that its been unpaused and by what address
        console.log("Token unpaused by", owner.address);
  
      // Optional: check that transfers work again
      await expect(
        token.connect(owner).transfer(addr1.address, 1)
      ).to.not.be.reverted;
    });
  
    it("Non-PAUSER_ROLE cannot pause", async function () {
      await expect(token.connect(addr1).pause()).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.PAUSER_ROLE()}`
      );
    });
  
    it("Non-PAUSER_ROLE cannot unpause", async function () {
      await token.connect(owner).pause();
      await expect(token.connect(addr1).unpause()).to.be.revertedWith(
        `AccessControl: account ${addr1.address.toLowerCase()} is missing role ${await token.PAUSER_ROLE()}`
      );
    });
  });

  describe("Burning", function () {
    it("Owner can burn tokens and emit TokensBurned", async function () {
      const burnAmount = ethers.utils.parseUnits("1000", 18);
  
      await expect(token.connect(owner).burn(burnAmount))
        .to.emit(token, "TokensBurned")
        .withArgs(owner.address, burnAmount);
  
      console.log("Tokens burned by", owner.address);
  
      const balance = await token.balanceOf(owner.address);
      expect(balance.toString()).to.equal(
        ethers.utils.parseUnits("99000", 18).toString() // initial 100000 - 1000 burned
      );
    });

    it("Other account can burn their tokens after receiving them", async function () {
      const transferAmount = ethers.utils.parseUnits("5000", 18);
      const burnAmount = ethers.utils.parseUnits("2000", 18);
  
      // Owner transfers some tokens to addr1
      await token.connect(owner).transfer(addr1.address, transferAmount);
  
      // addr1 burns some tokens
      await expect(token.connect(addr1).burn(burnAmount))
        .to.emit(token, "TokensBurned")
        .withArgs(addr1.address, burnAmount);
  
      const balance = await token.balanceOf(addr1.address);
      expect(balance.toString()).to.equal(
        ethers.utils.parseUnits("3000", 18).toString() // 5000 received - 2000 burned
      );
    });
  
    it("Cannot burn more than your balance", async function () {
      const burnAmount = ethers.utils.parseUnits("2000", 18);
    
      // addr1 currently has 3000 from previous test, let's try to burn more than they have
      const overBurnAmount = ethers.utils.parseUnits("5000", 18);
    
      await expect(token.connect(addr1).burn(overBurnAmount))
        .to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    // @notice Verifies that burnFrom emits the TokensBurned event and correctly reduces balance
    it("burnFrom emits TokensBurned event", async function () {
      const transferAmount = ethers.utils.parseUnits("5000", 18);
      const burnAmount = ethers.utils.parseUnits("2000", 18);
    
      // Give addr1 some tokens
      await token.connect(owner).transfer(addr1.address, transferAmount);
    
      // addr1 approves owner to spend on their behalf
      await token.connect(addr1).approve(owner.address, burnAmount);
    
      // Owner burns from addr1's balance
      await expect(token.connect(owner).burnFrom(addr1.address, burnAmount))
        .to.emit(token, "TokensBurned")
        .withArgs(addr1.address, burnAmount);
    
      const balance = await token.balanceOf(addr1.address);
      expect(balance.toString()).to.equal(
        ethers.utils.parseUnits("3000", 18).toString() // 5000 - 2000
      );
    });
    
    // @notice Verifies that burnFrom reverts when no allowance has been approved
    it("burnFrom fails without allowance", async function () {
      const burnAmount = ethers.utils.parseUnits("1000", 18);
      const transferAmount = ethers.utils.parseUnits("5000", 18);
    
      await token.connect(owner).transfer(addr1.address, transferAmount);
    
      // No approve() called — should revert
      await expect(
        token.connect(owner).burnFrom(addr1.address, burnAmount)
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  });

  describe("Cap", function () {
    it("Cannot mint beyond the max cap", async function () {
      const cap = await token.cap();
      const currentSupply = await token.totalSupply();
      const remaining = cap.sub(currentSupply);
  
      // Mint up to the cap – should work
      await expect(token.connect(owner).mint(addr1.address, remaining))
        .to.emit(token, "TokensMinted")
        .withArgs(addr1.address, remaining);
  
      // Now try to mint 1 more – should revert
      await expect(token.connect(owner).mint(addr1.address, 1))
        .to.be.revertedWith("ERC20Capped: cap exceeded");
    });
  });

  describe("Access Control", function () {

    it("Admin can grant MINTER_ROLE", async function () {
      const minterRole = await token.MINTER_ROLE();
  
      await token.connect(owner).grantRole(minterRole, addr2.address);
  
      expect(await token.hasRole(minterRole, addr2.address)).to.equal(true);
  
      console.log("Admin granted MINTER_ROLE to", addr2.address);
    });
  
    it("Non-admin cannot grant MINTER_ROLE", async function () {
      const minterRole = await token.MINTER_ROLE();
  
      await expect(
        token.connect(addr2).grantRole(minterRole, addr2.address)
      ).to.be.reverted;
  
    });
  
  });

  // @notice Tests that the renounceRole override correctly blocks and allows renouncing based on role type
  describe("renounceRole Protection", function () {
      
    // @notice Verifies that the admin cannot renounce DEFAULT_ADMIN_ROLE, preventing permanent lockout
    it("Admin cannot renounce DEFAULT_ADMIN_ROLE", async function () {
      const adminRole = await token.DEFAULT_ADMIN_ROLE();
  
      await expect(
        token.connect(owner).renounceRole(adminRole, owner.address)
      ).to.be.revertedWith("Cannot renounce admin role");
    });
  
      // @notice Verifies that non-admin roles like MINTER_ROLE can still be renounced freely
    it("MINTER_ROLE can still be renounced", async function () {
      const minterRole = await token.MINTER_ROLE();
  
      await expect(
        token.connect(owner).renounceRole(minterRole, owner.address)
      ).to.not.be.reverted;
  
      expect(await token.hasRole(minterRole, owner.address)).to.equal(false);
    });
  });
});