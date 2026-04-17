pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";

template UnemploymentBenefitProof(depth) {
    signal input merkleRoot;
    signal input programIdField;
    signal input recipientField;
    signal input nullifierHash;

    signal input identityHash;
    signal input secretSalt;
    signal input walletBinding;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    signal leaf;
    signal merklePath[depth + 1];
    signal leftNode[depth];
    signal rightNode[depth];
    component levelHashers[depth];

    component leafHasher = Poseidon(3);
    leafHasher.inputs[0] <== identityHash;
    leafHasher.inputs[1] <== secretSalt;
    leafHasher.inputs[2] <== walletBinding;
    leaf <== leafHasher.out;

    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== identityHash;
    nullifierHasher.inputs[1] <== programIdField;
    nullifierHasher.inputs[2] <== walletBinding;
    nullifierHasher.out === nullifierHash;

    walletBinding === recipientField;
    merklePath[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        leftNode[i] <== merklePath[i] + pathIndices[i] * (pathElements[i] - merklePath[i]);
        rightNode[i] <== pathElements[i] + pathIndices[i] * (merklePath[i] - pathElements[i]);

        levelHashers[i] = Poseidon(2);
        levelHashers[i].inputs[0] <== leftNode[i];
        levelHashers[i].inputs[1] <== rightNode[i];
        merklePath[i + 1] <== levelHashers[i].out;
    }

    merklePath[depth] === merkleRoot;
}

component main { public [merkleRoot, programIdField, recipientField, nullifierHash] } = UnemploymentBenefitProof(20);
