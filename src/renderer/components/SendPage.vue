<template>
    <div class="send-page">
        <div class="send-primary">
            <SearchInput v-model="filter" placeholder="Search by label or address" />

            <AnimatedTable
                ref="animatedTable"
                :fields="tableFields"
                :data="filteredSendAddresses"
                :track-by="'address'"
                :on-row-select="navigateToAddressBookItem"
                :compare-elements="(a, b) => a.address === b.address"
                no-data-message="No Saved Addresses"
            />
        </div>

        <div class="send-detail detail" :class="{disabled: formDisabled}">
            <div class="inner">
                <div class="top">
                    <InputFrame label="Label">
                        <input
                            id="label"
                            ref="label"
                            v-model.trim.lazy="label"
                            v-focus
                            type="text"
                            name="label"
                            tabindex="1"
                            placeholder="Label"
                            :disabled="formDisabled"
                        />
                    </InputFrame>

                    <InputFrame label="Address">
                        <input
                            id="address"
                            ref="address"
                            v-model="address"
                            v-validate.initial="'firoAddress'"
                            v-tooltip="getValidationTooltip('address')"
                            type="text"
                            name="address"
                            tabindex="2"
                            placeholder="Address"
                            spellcheck="false"
                            :disabled="formDisabled"
                        />
                    </InputFrame>

                    <div class="checkbox-field add-to-address-book" :class="{disabled: !showAddToAddressBook}">
                        <PlusButton :disabled="!showAddToAddressBook" />
                        <label @click="addToAddressBook">Add to address book</label>
                    </div>

                    <InputFrame class="input-frame-amount" label="Amount">
                        <input
                            id="amount"
                            ref="amount"
                            v-model="amount"
                            v-validate.initial="amountValidations"
                            v-tooltip="getValidationTooltip('amount')"
                            type="text"
                            name="amount"
                            class="amount"
                            tabindex="3"
                            placeholder="Amount"
                        />
                    </InputFrame>

                    <div class="checkbox-field">
                        <input type="checkbox" v-model="useCustomInputs" :disabled="formDisabled"/>
                        <label><a id="custom-inputs-button" href="#" @click="useCustomInputs = showCustomInputSelector = true">Custom Inputs (Coin Control)</a></label>

                        <Popup v-if="showCustomInputSelector">
                            <InputSelection v-model="customInputs" :is-private="isPrivate" @cancel="useCustomInputs = showCustomInputSelector = false" @ok="showCustomInputSelector = false" />
                        </Popup>
                    </div>

                    <div v-if="useCustomInputs" class="max-send">
                        <label>Max Send:</label>
                        <amount :amount="coinControlSelectedAmount" ticker="FIRO" />
                    </div>

                    <div class="checkbox-field">
                        <input id="subtract-fee-from-amount" type="checkbox" v-model="subtractFeeFromAmount" />
                        <label>Take Transaction Fee From Amount</label>
                    </div>

                    <div class="checkbox-field">
                        <input id="use-custom-fee" type="checkbox" v-model="useCustomFee" />
                        <label>Custom Transaction Fee</label>
                    </div>

                    <InputFrame v-if="useCustomFee" class="input-frame-tx-fee" unit="sat/kb">
                        <input
                            id="txFeePerKb"
                            ref="txFeePerKb"
                            v-model="userTxFeePerKb"
                            v-validate.initial="'txFeeIsValid'"
                            v-tooltip="getValidationTooltip('txFeePerKb')"
                            :placeholder="smartFeePerKb"
                            type="text"
                            name="txFeePerKb"
                            tabindex="4"
                        />
                    </InputFrame>

                    <div class="totals">
                        <div class="total-field">
                            <label>
                                Recipient will receive:
                            </label>

                            <div v-if="transactionFee" class="value">
                                <amount :amount="amountToReceive" ticker="FIRO" />
                            </div>
                            <div v-else class="value" />
                        </div>

                        <div class="total-field">
                            <label>
                                Transaction fee:
                            </label>

                            <div v-if="transactionFee" id="computed-transaction-fee" class="value">
                                <amount :amount="transactionFee" ticker="FIRO" />
                            </div>
                            <div v-else class="value" />
                        </div>

                        <div class="total-field">
                            <label>
                                Total:
                            </label>

                            <div v-if="transactionFee" class="value">
                                <amount :amount="totalAmount" ticker="FIRO" />
                            </div>

                            <div v-else class="value" />
                        </div>
                    </div>
                </div>

                <div class="bottom">
                    <SendFlow
                        :disabled="!canBeginSend"
                        :is-private="isPrivate"
                        :label="label"
                        :address="address"
                        :amount="satoshiAmount"
                        :tx-fee-per-kb="txFeePerKb"
                        :computed-tx-fee="transactionFee || 0"
                        :subtract-fee-from-amount="subtractFeeFromAmount"
                        :coin-control="coinControl"
                        @success="() => (feeMap = {}) && cleanupForm()"
                        @reset="() => (feeMap = {}) && cleanupForm(false)"
                    />

                    <div class="footer">
                        <PrivatePublicBalance :disabled="!isBlockchainSynced" v-model="isPrivate" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { mapGetters } from 'vuex';
import SendFlow from "renderer/components/SendPage/SendFlow";
import {isValidAddress} from 'lib/isValidAddress';
import {convertToSatoshi, convertToCoin} from 'lib/convert';
import Amount from "renderer/components/shared/Amount";
import InputSelection from "renderer/components/SendPage/InputSelection";
import Popup from "renderer/components/shared/Popup";
import AnimatedTable from "renderer/components/AnimatedTable/AnimatedTable";
import CurrentAddressIndicator from "renderer/components/AnimatedTable/CurrentAddressIndicator";
import AddressBookItemLabel from "renderer/components/AnimatedTable/AddressBookItemLabel";
import AddressBookItemAddress from "renderer/components/AnimatedTable/AddressBookItemAddress";
import PrivatePublicBalance from "renderer/components/shared/PrivatePublicBalance";
import SearchInput from "renderer/components/shared/SearchInput";
import InputFrame from "renderer/components/shared/InputFrame";
import PlusButton from "renderer/components/shared/PlusButton";

export default {
    name: 'SendPage',

    components: {
        PlusButton,
        PrivatePublicBalance,
        AnimatedTable,
        SendFlow,
        Amount,
        InputSelection,
        Popup,
        InputFrame,
        SearchInput
    },

    inject: [
        '$validator'
    ],

    data () {
        return {
            label: this.$route.query.label || '',
            amount: this.$route.query.amount || '',
            address: this.$route.query.address || '',
            subtractFeeFromAmount: false,
            useCustomFee: false,
            userTxFeePerKb: '',
            isPrivate: true,
            showCustomInputSelector: false,
            useCustomInputs: false,
            customInputs: [],
            tableFields: [
                {name: CurrentAddressIndicator},
                {name: AddressBookItemLabel},
                {name: AddressBookItemAddress}
            ],
            // This is the search term to filter addresses by.
            filter: ''
        }
    },

    computed: {
        ...mapGetters({
            network: 'ApiStatus/network',
            isLelantusAllowed: 'ApiStatus/isLelantusAllowed',
            isBlockchainSynced: 'ApiStatus/isBlockchainSynced',
            availablePrivate: 'Balance/availablePrivate',
            availablePublic: 'Balance/availablePublic',
            sendAddresses: 'AddressBook/sendAddresses',
            addressBook: 'AddressBook/addressBook',
            smartFeePerKb: 'ApiStatus/smartFeePerKb',
            calculateTransactionFee: 'Transactions/calculateTransactionFee'
        }),

        transactionFee() {
            if (!this.satoshiAmount) return undefined;
            return this.calculateTransactionFee(this.isPrivate, this.satoshiAmount, this.txFeePerKb, this.subtractFeeFromAmount, this.customInputs.length ? this.customInputs : undefined);
        },

        formDisabled() {
            return !this.isBlockchainSynced || (this.isPrivate && !this.isLelantusAllowed);
        },

        txFeePerKb() {
            return Number(this.userTxFeePerKb) || this.smartFeePerKb;
        },

        filteredSendAddresses () {
            this.$nextTick(() => this.$refs.animatedTable.reload());
            return this.sendAddresses
                .filter(address => address.label.includes(this.filter) || address.address.includes(this.filter))
                .map(address => ({isSelected: address.address === this.address, ...address}));
        },

        showAddToAddressBook () {
            return !this.formDisabled && isValidAddress(this.address, this.network) && !this.addressBook[this.address];
        },

        coinControl () {
            return this.customInputs.length ? this.customInputs.map(txo => [txo.txid, txo.index]) : undefined;
        },

        coinControlSelectedAmount () {
            return this.customInputs.reduce((a, txo) => a + txo.amount, 0);
        },

        available () {
            return this.isPrivate ? this.availablePrivate : this.availablePublic;
        },

        // This is the amount the user entered in satoshis.
        satoshiAmount () {
            return convertToSatoshi(this.amount);
        },

        // This is the amount the user will receive. It may be less than satoshiAmount.
        amountToReceive () {
            return this.subtractFeeFromAmount ? this.satoshiAmount - this.transactionFee : this.satoshiAmount;
        },

        // This is the total amount that will be sent, including transaction fee.
        totalAmount () {
            return this.subtractFeeFromAmount ? this.satoshiAmount : this.satoshiAmount + this.transactionFee;
        },

        // We can begin the send if the fee has been shown and the form is valid.
        canBeginSend () {
            return this.isValidated && this.transactionFee > 0 && !this.totalAmountExceedsBalance;
        },

        isValidated () {
            // this.errors was already calculated when amount and address were entered.
            return !!(this.amount && this.address && this.transactionFee && !this.validationErrors.items.length);
        },

        amountValidations () {
            if (this.isPrivate) {
                return 'amountIsWithinAvailableBalance|amountIsValid|privateAmountDoesntViolateSpendLimit';
            } else {
                return 'amountIsWithinAvailableBalance|amountIsValid';
            }
        },

        getValidationTooltip () {
            return (fieldName) => ({
                content: this.validationErrors.first(fieldName),
                trigger: 'manual',
                boundariesElement: 'body',
                offset: 8,
                placement: 'left',
                classes: 'error',
                show: true
            })
        }
    },

    watch: {
        $route(to) {
            this.address = to.query.address || '';
            this.label = to.query.label || '';
            this.amount = to.query.amount || '';
        },

        useCustomFee() {
            if (!this.useCustomFee) {
                // Make sure the validation warning goes away.
                this.userTxFeePerKb = '';
            }
        },

        subtractFeeFromAmount() {
            this.$validator.validate('amount');
        },

        useCustomInputs() {
            if (this.useCustomInputs) {
                this.showCustomInputSelector = true;
            } else {
                this.customInputs = [];
            }

            this.$validator.validateAll();
        },

        coinControlSelectedAmount() {
            this.$validator.validateAll();
        },

        userTxFeePerKb() {
            this.$validator.validateAll();
        },

        isPrivate() {
            this.cleanupForm(false);
        },

        label() {
            const a = this.addressBook[this.address];
            if (a && a.purpose === 'send' && a.label !== this.label) {
                this.addToAddressBook();
            }
        },

        address() {
            const a = this.addressBook[this.address];
            if (a && a.purpose === 'send' && a.label !== this.label) {
                this.addToAddressBook();
            }
        }
    },

    beforeMount () {
        // Set up VeeValidator rules.

        this.$validator.extend('firoAddress', {
            getMessage: () => 'The Firo address you entered is invalid',
            validate: (value) => isValidAddress(value, this.network)
        });

        this.$validator.extend('amountIsWithinAvailableBalance', {
            // this.availableXzc will still be reactively updated.
            getMessage: () => this.useCustomInputs ?
                `Amount (including fees) is over the sum of your selected coins, ${convertToCoin(this.coinControlSelectedAmount)} FIRO`
                :
                `Amount (including fees) is over your available balance of ${convertToCoin(this.available)} FIRO`,

            validate: (value) => !!this.transactionFee
        });

        this.$validator.extend('amountIsValid', {
            getMessage: () => 'Amount must be a multiple of 0.00000001',
            // We use a regex here so as to not to have to deal with floating point issues.
            validate: (value) => Number(value) !== 0 && !!value.match(/^\d+(\.\d{1,8})?$/)
        });

        this.$validator.extend('privateAmountDoesntViolateSpendLimit', {
            getMessage: () =>
                `Due to private transaction spend limits, you may not spend more than 5001 FIRO (including fees) in one transaction`,

            validate: (value) => this.totalAmount <= 5001e8
        });

        this.$validator.extend('txFeeIsValid', {
            getMessage: () => 'Transaction fee must be an integer between 1 and 1,000,000',
            validate: (value) => value > 0 && value <= 1_000_000 && (value % 1 === 0)
        })
    },

    methods: {
        convertToCoin,

        async addToAddressBook() {
            if (!isValidAddress(this.address, this.network) || !this.label) return;

            if (this.addressBook[this.address]) {
                const item = this.addressBook[this.address]
                await $daemon.updateAddressBookItem(item, this.label);
                $store.commit('AddressBook/updateAddress', {...item, label: this.label});
                this.$refs.animatedTable.reload();
            } else {
                const item = {
                    address: this.address,
                    label: this.label,
                    purpose: 'send'
                };
                $store.commit('AddressBook/updateAddress', {...item, createdAt: Date.now()});
                await $daemon.addAddressBookItem(item);
            }
        },

        navigateToAddressBookItem(addressBookItem) {
            this.address = addressBookItem.address;
            this.label = addressBookItem.label;
        },

        cleanupForm(enablePrivate=true) {
            if (enablePrivate) this.isPrivate = true;
            this.useCustomInputs = false;
            this.useCustomFee = false;
            this.subtractFeeFromAmount = false;
            this.label = '';
            this.amount = '';
            this.address = '';
        }
    }
}
</script>

<style lang="scss">
.send-page {
    height: 100%;
    display: flex;

    .send-primary {
        height: 100%;
        flex-grow: 1;
        display: flex;
        flex-direction: column;

        padding: var(--padding-base);

        .animated-table {
            margin-top: var(--padding-base);
            flex-grow: 1;
        }
    }

    .send-detail {
        height: 100%;
        width: var(--width-detail);
        padding: var(--padding-base);
        background-color: var(--color-background-detail);

        &.disabled {
            opacity: 0.3;
        }

        .inner {
            height: 100%;
            display: flex;
            flex-flow: column;

            .top {
                flex-grow: 1;

                .framed-input {
                    width: 100%;
                }

                .add-to-address-book {
                    margin-bottom: 10px;

                    &:not(.disabled) {
                        &, label {
                            cursor: pointer;
                        }
                    }

                    &.disabled {
                        &, label {
                            color: var(--color-text-disabled);
                        }
                    }

                    label {
                        color: var(--color-secondary);
                        font-weight: bold;
                    }
                }

                .input-frame-amount {
                    margin-bottom: 20px;
                }

                .checkbox-field:not(.add-to-address-book) {
                    margin-bottom: 6px;
                }

                .max-send {
                    margin-bottom: 10px;
                    opacity: 0.5;
                    font-weight: bold;

                    label, .amount {
                        display: inline-block;
                    }

                    .amount {
                        color: var(--color-secondary);
                    }
                }

                .totals {
                    margin-top: 30px;
                    padding-top: 30px;
                    border-top: {
                        width: 1px;
                        color: var(--color-text-subtle-border);
                        style: solid;
                    }

                    .total-field {
                        display: flex;
                        justify-content: space-between;
                    }
                }
            }

            .bottom {
                .error {
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: var(--padding-base);
                }
            }
        }
    }
}
</style>
