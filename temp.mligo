let tez_to_cash (param : tez_to_cash) (storage : storage) =
   let { to_ = to_ ;
         minCashBought = minCashBought ;
         deadline = deadline ;
         rounds = rounds } = param in
    let tezSold = mutez_to_natural (Tezos.get_amount ()) in
    if (Tezos.get_now ()) >= deadline then
        (failwith error_THE_CURRENT_TIME_MUST_BE_LESS_THAN_THE_DEADLINE : result)
    else begin
        (* We don't check that tezPool > 0, because that is impossible
           unless all liquidity has been removed. *)
        let tezPool = storage.tezPool in
        let cash_bought =
            // tez -> cash calculation; *includes a fee*
            let bought = trade_dtez_for_dcash tezPool storage.cashPool tezSold storage.target rounds in
            let bought_after_fee = bought * const_fee / const_fee_denom in
            if bought_after_fee < minCashBought then
                (failwith error_CASH_BOUGHT_MUST_BE_GREATER_THAN_OR_EQUAL_TO_MIN_CASH_BOUGHT : nat)
            else
                bought_after_fee
        in
        let new_cashPool = (match is_nat (storage.cashPool - cash_bought) with
            | None -> (failwith error_CASH_POOL_MINUS_CASH_BOUGHT_IS_NEGATIVE : nat)
            | Some difference -> difference) in

        (* Update tezPool. *)
        let storage = { storage with tezPool = storage.tezPool + tezSold ; cashPool = new_cashPool } in
        (* Send tez from sender to self. *)
        (* Send cash_withdrawn from exchange to sender. *)
        let op_cash = cash_transfer storage (Tezos.get_self_address ()) to_ cash_bought in
        ([op_cash], storage)
    end
