// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title LuLuCoin
/// @notice Tutorial ERC20 token; owner can mint and burn.
contract LuLuCoin is ERC20, Ownable {
    event Mint(uint256 indexed amount);
    event Burn(uint256 indexed amount);

    string public _name = "LuLuCoin";
    string public _symbol = "LLC";

    constructor(address initialOwner) ERC20(_name, _symbol) Ownable(initialOwner) {}

    /// @notice Mint tokens to the owner.
    /// @param _amount Amount in the token's smallest unit (18 decimals).
    function mint(uint256 _amount) public onlyOwner {
        _mint(msg.sender, _amount);
        emit Mint(_amount);
    }

    /// @notice Burn tokens from the owner.
    /// @param _amount Amount in the token's smallest unit (18 decimals).
    function burn(uint256 _amount) public onlyOwner {
        _burn(msg.sender, _amount);
        emit Burn(_amount);
    }
}
