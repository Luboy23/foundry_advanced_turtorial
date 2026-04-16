// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IAlcoholAgeEligibilityVerifier {
    struct EligibilityStatus {
        uint32 verifiedRootVersion;
        uint64 verifiedAt;
        bool active;
    }

    function getEligibility(address buyer) external view returns (EligibilityStatus memory);
    function hasValidEligibility(address buyer) external view returns (bool);
}
