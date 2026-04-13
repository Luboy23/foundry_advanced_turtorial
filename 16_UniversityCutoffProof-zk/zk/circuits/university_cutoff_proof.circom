pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// 这条电路证明三件事：
// 1. 学生提交的成绩确实属于考试院公布的成绩树；
// 2. 该成绩满足目标大学当前录取线；
// 3. 发起申请的钱包地址与成绩凭证中绑定的学生地址完全一致。
template ExamPass(depth) {
    // 公共输入：链上 verifier 和合约都能看到的事实。
    signal input merkleRoot;
    signal input scoreSourceIdField;
    signal input schoolIdField;
    signal input cutoffScore;
    signal input recipientField;
    signal input nullifierHash;

    // 私有输入：学生成绩凭证中携带、但不会直接公开上链的详细数据。
    signal input candidateIdHash;
    signal input score;
    signal input secretSalt;
    signal input boundStudentField;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    signal leaf;
    signal merklePath[depth + 1];
    signal leftNode[depth];
    signal rightNode[depth];
    component levelHashers[depth];

    // 叶子同时绑定成绩源、学生身份摘要、成绩、安全盐和学生钱包地址。
    // 把 boundStudentField 放进叶子后，即使凭证文件泄露，别人换钱包也无法复用这份凭证。
    component leafHasher = Poseidon(5);
    leafHasher.inputs[0] <== scoreSourceIdField;
    leafHasher.inputs[1] <== candidateIdHash;
    leafHasher.inputs[2] <== score;
    leafHasher.inputs[3] <== secretSalt;
    leafHasher.inputs[4] <== boundStudentField;
    leaf <== leafHasher.out;

    merklePath[0] <== leaf;

    // LessThan(32) 的输出为 1 表示 score < cutoffScore。
    // 这里强制输出为 0，也就是学生成绩必须大于等于录取线。
    component cutoffCheck = LessThan(32);
    cutoffCheck.in[0] <== score;
    cutoffCheck.in[1] <== cutoffScore;
    cutoffCheck.out === 0;

    component nullifierHasher = Poseidon(4);
    nullifierHasher.inputs[0] <== schoolIdField;
    nullifierHasher.inputs[1] <== candidateIdHash;
    nullifierHasher.inputs[2] <== recipientField;
    nullifierHasher.inputs[3] <== scoreSourceIdField;
    nullifierHasher.out === nullifierHash;

    // 这条约束把“成绩凭证绑定的钱包”和“本次交易的 recipient”锁成同一个字段值。
    boundStudentField === recipientField;

    for (var i = 0; i < depth; i++) {
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        // 根据 pathIndices 决定当前节点是左子还是右子，再与兄弟节点一起向上恢复 Merkle 路径。
        leftNode[i] <== merklePath[i] + pathIndices[i] * (pathElements[i] - merklePath[i]);
        rightNode[i] <== pathElements[i] + pathIndices[i] * (merklePath[i] - pathElements[i]);

        levelHashers[i] = Poseidon(2);
        levelHashers[i].inputs[0] <== leftNode[i];
        levelHashers[i].inputs[1] <== rightNode[i];
        merklePath[i + 1] <== levelHashers[i].out;
    }

    merklePath[depth] === merkleRoot;
}

// 当前项目固定使用深度 20 的成绩树，公共输入顺序必须与前端和 verifier 完全一致。
component main { public [merkleRoot, scoreSourceIdField, schoolIdField, cutoffScore, recipientField, nullifierHash] } = ExamPass(20);
