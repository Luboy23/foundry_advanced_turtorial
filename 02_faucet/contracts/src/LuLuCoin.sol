// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title LuLuCoin
/// @notice 简单的 ERC20 示例代币，支持仅所有者 mint/burn
contract LuLuCoin is ERC20, Ownable {
    /// @notice 铸造代币时触发
    event Mint(uint256 indexed amount);

    /// @notice 销毁代币时触发
    event Burn(uint256 indexed amount);

    string public _name = "LuLuCoin";
    string public _symbol = "LLC";

    /// @notice 初始化代币名称、符号与所有者
    /// @param initialOwner 合约所有者
    constructor(address initialOwner) ERC20(_name, _symbol) Ownable(initialOwner) {}

    /// @notice 铸造代币到所有者地址
    /// @param _amount 铸造数量（代币最小单位）
    function mint(uint256 _amount) public onlyOwner {
        _mint(msg.sender, _amount);
        emit Mint(_amount);
    }

    /// @notice 销毁所有者持有的代币
    /// @param _amount 销毁数量（代币最小单位）
    function burn(uint256 _amount) public onlyOwner {
        _burn(msg.sender, _amount);
        emit Burn(_amount);
    }
}
