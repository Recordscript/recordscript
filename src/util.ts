// https://datatracker.ietf.org/doc/html/rfc1035#section-2.3.1
export function validate_domain_name(name: string): boolean {
    if (name.length > 253) return false;

    const labels = name.split(".");
    if (labels.some((label) => label.length === 0 || label.length > 63)) return false;

    const label_regex = /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
    if (!labels.every((label) => label_regex.test(label))) return false;

    return true;
}

export function validate_port(port: number): boolean {
    if (!Number.isInteger(port)) return false;

    return port >= 0 && port <= 65535;
}

// https://datatracker.ietf.org/doc/html/rfc5322#section-3.4.1
export function validate_email(email: string): boolean {
    const parts = email.split("@");
    if (parts.length !== 2) return false;

    const [local, domain] = parts;

    function is_valid_local(local: string) {
        if (local.length > 64) return false;

        const valid_chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&'*+-/=?^_`{|}~.";

        for (const char of local) {
            if (!valid_chars.includes(char)) {
                return false;
            }
        }

        return true;
    }

    return is_valid_local(local) && validate_domain_name(domain);
}

// https://datatracker.ietf.org/doc/html/rfc1036#section-2.1.1
export function validate_email_from_header(from: string): boolean {
    const angle_email_regex = /<([^>]+)>/;
    const paren_name_regex = /\(([^)]+)\)/;

    let email, name;

    if (angle_email_regex.test(from)) {
        email = from.match(angle_email_regex)?.[1];
        name = from.split("<")[0].trim();
    } else if (paren_name_regex.test(from)) {
        email = from.split("(")[0].trim();
        name = from.match(paren_name_regex)?.[1];
    } else {
        email = from.trim();
    }

    function is_valid_name(name: string) {
        const invalid_chars = "()<>";

        for (const char of name) {
            if (invalid_chars.includes(char)) {
                return false;
            }
        }

        return true;
    }

    return validate_email(email ?? "") && (!name || is_valid_name(name));
}

