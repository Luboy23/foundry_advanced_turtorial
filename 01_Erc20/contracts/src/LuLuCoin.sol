// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title LuLuCoin
/// @notice ERC-20 token with owner-only mint and burn.
/// @dev Inherits OpenZeppelin ERC20 + Ownable; mints/burns from msg.sender only.
contract LuLuCoin is ERC20, Ownable {
    /// @notice Emitted when tokens are minted by the owner.
    /// @param amount Amount minted in token smallest units.
    event Mint(uint256 indexed amount);

    /// @notice Emitted when tokens are burned by the owner.
    /// @param amount Amount burned in token smallest units.
    event Burn(uint256 indexed amount);

    /// @notice Human-readable token name.
    string public _name = "LuLuCoin";

    /// @notice Token symbol.
    string public _symbol = "LLC";

    /// @param initialOwner Address to receive ownership.
    /// @dev No initial mint is performed.
    constructor(address initialOwner) ERC20(_name, _symbol) Ownable(initialOwner) {}

    /// @notice Mints tokens to the caller. Only callable by the owner.
    /// @param _amount Amount to mint, in token smallest units.
    /// @dev Emits {Mint}.
    function mint(uint256 _amount) public onlyOwner {
        _mint(msg.sender, _amount);
        emit Mint(_amount);
    }

    /// @notice Burns tokens from the caller. Only callable by the owner.
    /// @param _amount Amount to burn, in token smallest units.
    /// @dev Emits {Burn}.
    function burn(uint256 _amount) public onlyOwner {
        _burn(msg.sender, _amount);
        emit Burn(_amount);
    }
}
