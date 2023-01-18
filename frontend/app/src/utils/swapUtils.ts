const util = (x: number, y: number) => {
    const plus = x + y;
    const minus = x - y;
    const plus_2 = plus * plus;
    const plus_4 = plus_2 * plus_2;
    const plus_8 = plus_4 * plus_4;
    const plus_7 = plus_4 * plus_2 * plus;
    const minus_2 = minus * minus;
    const minus_4 = minus_2 * minus_2;
    const minus_8 = minus_4 * minus_4;
    const minus_7 = minus_4 * minus_2 * minus;
    return [Math.abs(plus_8 - minus_8), 8 * (Math.abs(minus_7 + plus_7))] // 8n to 8


}

const newton = (p: any): number => {
    if (p.n === 0) {
        return p.dy
    }
    const util_arr = util((p.x + p.dx), (Math.abs(p.y - p.dy)));
    const new_u = util_arr[0];
    const new_du_dy = util_arr[1];
    const dy = p.dy + Math.abs((new_u - p.u) / new_du_dy);
    return newton({
        x: p.x,
        y: p.y,
        dx: p.dx,
        dy,
        u: p.u,
        n: p.n - 1
    });

}

const newton_dx_to_dy = (
    args: any
) => {
    const xp = args.x + args.dx;
    const u = util(args.x, args.y)[0];
    return newton({
        x: args.x,
        y: args.y,
        dx: args.dx,
        dy: 0,
        u,
        n: args.rounds
    })
}


export const trade_dtez_for_dcash = (
    args: any
) => {
    const x = args.tez * (2 ** 48);
    const y = args.target * args.cash;
    const dx = args.dtez * (2 ** 48);
    const dy_approx = newton_dx_to_dy({
        x,
        y,
        dx,
        rounds: args.rounds
    });
    const dcash_approx = dy_approx / args.target;
    return dcash_approx
}

export const trade_dcash_for_dtez = (
    args: any
) => {
    const x = args.target * args.cash;
    const y = args.tez * (2 ** 48);
    const dx = args.target * args.dtez;
    const dy_approx = newton_dx_to_dy({
        x,
        y,
        dx,
        rounds: args.rounds
    });
    const dtez_approx = dy_approx / (2 ** 48);
    return dtez_approx
}