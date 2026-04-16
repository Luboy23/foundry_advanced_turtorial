// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @notice 把 Unix 时间戳稳定映射为 UTC 日期的 YYYYMMDD 整数表示。
/// @dev 资格验证层只关心“今天的 UTC 日期是多少”，不关心具体时分秒。
library DateYmdLib {
    uint256 internal constant SECONDS_PER_DAY = 24 * 60 * 60;
    int256 internal constant OFFSET19700101 = 2440588;

    function timestampToUtcDateYmd(uint256 timestamp) internal pure returns (uint32) {
        (uint256 year, uint256 month, uint256 day) = _daysToDate(timestamp / SECONDS_PER_DAY);
        return uint32(year * 10000 + month * 100 + day);
    }

    // 这个换算算法的目标不是做通用日历库，而是给合约提供稳定、无时区歧义的 UTC 日粒度日期。
    function _daysToDate(uint256 _days) private pure returns (uint256 year, uint256 month, uint256 day) {
        int256 __days = int256(_days);

        int256 L = __days + 68569 + OFFSET19700101;
        int256 N = (4 * L) / 146097;
        L = L - (146097 * N + 3) / 4;
        int256 _year = (4000 * (L + 1)) / 1461001;
        L = L - (1461 * _year) / 4 + 31;
        int256 _month = (80 * L) / 2447;
        int256 _day = L - (2447 * _month) / 80;
        L = _month / 11;
        _month = _month + 2 - 12 * L;
        _year = 100 * (N - 49) + _year + L;

        year = uint256(_year);
        month = uint256(_month);
        day = uint256(_day);
    }
}
