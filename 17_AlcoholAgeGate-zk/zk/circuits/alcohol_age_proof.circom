pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// 这份电路证明的不是“我把生日公开给你看了”，
// 而是“我属于当前身份集合、这份凭证绑定当前钱包，并且当前日期已经到达我的成年起始日”。
template AlcoholAgeProof(depth) {
    // 公共输入：链上会直接读取并参与校验的最小字段。
    signal input merkleRoot;
    signal input version;
    signal input verificationDateYmd;
    signal input recipientField;

    // 私有输入：只存在于证明过程里的身份材料。
    signal input identityHash;
    signal input eligibleFromYmd;
    signal input secretSalt;
    signal input walletBinding;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    signal leaf;
    signal merklePath[depth + 1];
    signal leftNode[depth];
    signal rightNode[depth];
    component levelHashers[depth];

    // 叶子把版本、身份哈希、成年起始日、随机盐和钱包绑定一起承诺进树里，
    // 这样 proof 不只是“我是集合成员”，还是“我是当前版本下绑定到这个钱包的集合成员”。
    component leafHasher = Poseidon(5);
    leafHasher.inputs[0] <== version;
    leafHasher.inputs[1] <== identityHash;
    leafHasher.inputs[2] <== eligibleFromYmd;
    leafHasher.inputs[3] <== secretSalt;
    leafHasher.inputs[4] <== walletBinding;
    leaf <== leafHasher.out;

    merklePath[0] <== leaf;

    // LessThan(a, b) 输出 1 代表 a < b。
    // 这里要求 verificationDateYmd 不早于 eligibleFromYmd，也就是当前已经达到成年起始日。
    component ageCheck = LessThan(32);
    ageCheck.in[0] <== verificationDateYmd;
    ageCheck.in[1] <== eligibleFromYmd;
    ageCheck.out === 0;

    // 钱包绑定保证这份凭证不能被另一个地址借来复用。
    walletBinding === recipientField;

    for (var i = 0; i < depth; i++) {
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        // pathIndices 决定当前节点在左还是在右，从而稳定还原整条 Merkle path。
        leftNode[i] <== merklePath[i] + pathIndices[i] * (pathElements[i] - merklePath[i]);
        rightNode[i] <== pathElements[i] + pathIndices[i] * (merklePath[i] - pathElements[i]);

        levelHashers[i] = Poseidon(2);
        levelHashers[i].inputs[0] <== leftNode[i];
        levelHashers[i].inputs[1] <== rightNode[i];
        merklePath[i + 1] <== levelHashers[i].out;
    }

    // 最终只要能回到当前 active 集合的 root，链上就能确认这份私有凭证来自当前身份集合。
    merklePath[depth] === merkleRoot;
}

component main { public [merkleRoot, version, verificationDateYmd, recipientField] } = AlcoholAgeProof(20);
