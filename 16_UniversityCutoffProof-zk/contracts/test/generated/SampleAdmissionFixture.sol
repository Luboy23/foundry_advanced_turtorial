// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

library SampleAdmissionFixture {
    function scoreSourceId() internal pure returns (bytes32) {
        return 0x47414f4b414f5f32303236000000000000000000000000000000000000000000;
    }

    function scoreSourceTitle() internal pure returns (string memory) {
        return unicode"2026 全国统一高考";
    }

    function merkleRoot() internal pure returns (uint256) {
        return uint256(17160172088339261308992153955733465887161461088645320080014053643624746311335);
    }

    function maxScore() internal pure returns (uint32) {
        return 100;
    }

    function sampleRecipient() internal pure returns (address) {
        return 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    }

    function sampleScore() internal pure returns (uint32) {
        return 60;
    }

    function pkuSchoolId() internal pure returns (bytes32) {
        return 0x706b750000000000000000000000000000000000000000000000000000000000;
    }

    function pkuSchoolName() internal pure returns (string memory) {
        return unicode"北京大学";
    }

    function pkuCutoff() internal pure returns (uint32) {
        return 100;
    }

    function jiatingdunSchoolId() internal pure returns (bytes32) {
        return 0x6a696174696e6764756e00000000000000000000000000000000000000000000;
    }

    function jiatingdunSchoolName() internal pure returns (string memory) {
        return unicode"家里蹲大学";
    }

    function jiatingdunCutoff() internal pure returns (uint32) {
        return 50;
    }

    function sampleSuccessSchoolId() internal pure returns (bytes32) {
        return 0x6a696174696e6764756e00000000000000000000000000000000000000000000;
    }

    function sampleSuccessCutoff() internal pure returns (uint32) {
        return 50;
    }

    function sampleNullifierHash() internal pure returns (uint256) {
        return uint256(337340307896881763112463001656520845119165858657981895982831971933186859270);
    }

    function proofA() internal pure returns (uint256[2] memory value) {
        value = [uint256(20043442536789056186216991052454623010422304632894254339583047120869403485548), uint256(8495288129342425570061686382068808214662592971834892122304732039255014255318)];
    }

    function proofB() internal pure returns (uint256[2][2] memory value) {
        value = [[uint256(14909887257702739655245676273850188157333492877830233434164296524739036748369), uint256(4272701830596729762571189494559890042234003016832367526549691793531083968037)], [uint256(16407320778819006519373817313369976180647290316071580533232855847342933248187), uint256(3689530746676189664532988117965279609301278775133231896662040493272401293808)]];
    }

    function proofC() internal pure returns (uint256[2] memory value) {
        value = [uint256(770562594027875871575067705878932505051093546751431400659283569625887898794), uint256(20902859365357110501246115955616843022009742915520395462533870431384219103262)];
    }

    function publicSignals() internal pure returns (uint256[6] memory value) {
        value = [uint256(17160172088339261308992153955733465887161461088645320080014053643624746311335), uint256(10341361703618580472134084067389843097429664465969324510377409404945049845759), uint256(4354867755802077297580330623367192772034021196958469710874667399332078026750), uint256(50), uint256(642829559307850963015472508762062935916233390536), uint256(337340307896881763112463001656520845119165858657981895982831971933186859270)];
    }
}
