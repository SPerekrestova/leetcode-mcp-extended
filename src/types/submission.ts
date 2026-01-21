export interface SubmissionRequest {
    problemSlug: string;
    code: string;
    language: string;
}

export interface SubmissionResult {
    accepted: boolean;
    runtime?: string;
    memory?: string;
    failedTestCase?: string;
    errorMessage?: string;
    statusMessage: string;
}

export interface LeetCodeSubmitResponse {
    submission_id: number;
}

export interface LeetCodeCheckResponse {
    state: string;
    status_msg: string;
    runtime?: string;
    memory?: string;
    code_answer?: string[];
    expected_answer?: string[];
    input?: string;
    std_output?: string;
}
