import { API_URL } from "./constMessage";

interface IParam {
    [key: string]: string | number | boolean;
}

export class apiService {
    /**
  * Converts an object to query parameters string.
  * @param obj The object to be converted into query parameters.
  */
    static toQueryParams(obj: IParam): string {
        // Ensure that all values in IParam are converted to strings
        const params: Record<string, string> = {};

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                params[key] = String(obj[key]); // Convert each value to a string
            }
        }

        // Now it's safe to pass this params object to URLSearchParams
        return new URLSearchParams(params).toString();
    }

    static EndPoint = {
        userRegister: "auth/register",
        userLogin: "auth/login",
    };

    static Method = {
        get: "GET",
        post: "POST",
        patch: "PATCH",
        delete: "DELETE",
        put: "PUT",
    };

    /**
     * Makes a request to the specified API endpoint.
     *
     * @param {string} endpoint - The API endpoint to call.
     * @param {string} type - The HTTP method to use (GET, POST, PATCH, etc.).
     * @param {IParam | undefined} params - URL parameters to include in the request.
     * @param {object} payload - The request payload (data to send).
     * @param {Function} onCompletion - Callback function to call upon completion of the request.
     */
    static axiosCall(
        endpoint: string,
        type: string,
        params: IParam | undefined,
        payload: object,
        onCompletion: Function
    ) {
        const token = '';
        const url = `${API_URL}/${endpoint}${params ? `?${this.toQueryParams(params)}` : ''}`;

        const requestHeader: any = {
            Authorization: `Bearer ${token}`,
            "Content-Type": undefined,
        };
        let requestBody: any = payload;
        const formObject: any = {};

        if (!(payload instanceof FormData)) {
            if (type === "POST" || type === "PUT") {
                requestHeader["Content-Type"] = "application/json";
                requestBody = JSON.stringify(payload);
            } else {
                requestBody = undefined;
            }
        } else {
            payload.forEach((value, key) => {
                formObject[key] = value;
            });
        }

        chrome.runtime.sendMessage(
            {
                type: "api-request",
                token: token,
                method: type,
                header: requestHeader,
                body: requestBody,
                formData: formObject,
                requestUrl: url,
            },
            (response) => {
                onCompletion(response);
            }
        );
    }

    /**
     * Common function to make requests to the server.
     *
     * @param {string} endPoint - The API endpoint to call.
     * @param {string} method - The HTTP method to use (GET, POST, PATCH, etc.).
     * @param {IParam | undefined} params - URL parameters to include in the request.
     * @param {object} payload - The request payload (data to send).
     * @param {Function} onCompletion - Callback function to call upon completion of the request.
     */
    static commonAPIRequest(
        endPoint: string,
        method: string,
        params: IParam | undefined,
        payload: object,
        onCompletion: Function
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            this.axiosCall(endPoint, method, params, payload, (response: any) => {
                // You can handle the response and pass it to `onCompletion`
                try {
                    onCompletion(response);
                    resolve(response); // Resolving the promise
                } catch (error) {
                    reject(error); // Rejecting the promise in case of an error
                }
            });
        });
    }
}
