// SPDX-License-Identifier: MIT
// 许可证声明：指定合约的版权许可为 MIT，允许代码的自由使用和修改。

pragma solidity ^0.8.20;
// 指定 Solidity 编译器的版本。这里选择的是 0.8.20，确保合约在这一版本下编译通过。

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// 从 OpenZeppelin 导入 ERC20 合约，提供标准的 ERC20 代币功能。

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
// 从 OpenZeppelin 导入 Ownable 合约，确保只有合约所有者可以执行特定操作。

contract LuLuCoin is ERC20, Ownable {
    // 声明 LuLuCoin 合约，继承 ERC20 和 Ownable 两个功能模块。
    
    event Mint(uint256 indexed amount);
    // 声明 Mint 事件：在代币铸造时记录铸造的数量。

    event Burn(uint256 indexed amount);
    // 声明 Burn 事件：在代币销毁时记录销毁的数量。

    string public _name = "LuLuCoin";
    // 代币名称，供外部调用查询。

    string public _symbol = "LLC";
    // 代币符号，供外部调用查询。

    constructor(address initialOwner) ERC20(_name, _symbol) Ownable(initialOwner) {
        // 构造函数：初始化合约时设置代币的名称、符号，以及指定初始所有者。
    }

    function mint(uint256 _amount) public onlyOwner {
        // mint 函数：允许合约所有者铸造代币。
        // 参数 _amount：铸造的代币数量。

        _mint(msg.sender, _amount);
        // 调用 OpenZeppelin 提供的 _mint 函数，将指定数量的代币铸造到调用者账户。

        emit Mint(_amount);
        // 触发 Mint 事件，记录铸造的数量。
    }

    function burn(uint256 _amount) public onlyOwner {
        // burn 函数：允许合约所有者销毁代币。
        // 参数 _amount：销毁的代币数量。

        _burn(msg.sender, _amount);
        // 调用 OpenZeppelin 提供的 _burn 函数，从调用者账户销毁指定数量的代币。

        emit Burn(_amount);
        // 触发 Burn 事件，记录销毁的数量。
    }
}
