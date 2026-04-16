// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IAlcoholRoleRegistry {
    function getIssuer() external view returns (address);
    function getSeller() external view returns (address);
    function isIssuer(address account) external view returns (bool);
    function isBuyer(address account) external view returns (bool);
    function isSeller(address account) external view returns (bool);
    function isWhitelisted(address account) external view returns (bool);
    function setBuyers(address[] calldata buyers, bool active) external;
}
