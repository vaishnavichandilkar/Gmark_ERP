import { call, put, takeLatest } from 'redux-saga/effects';
import reportService from '../../services/reportService';
import {
    fetchReportsStart,
    fetchReportsSuccess,
    fetchReportsFailure
} from './reportSlice';

function* handleFetchReports() {
    try {
        const data = yield call(reportService.getReportData);
        yield put(fetchReportsSuccess(data));
    } catch (error) {
        yield put(fetchReportsFailure(error.message));
    }
}

export default function* reportSaga() {
    yield takeLatest(fetchReportsStart.type, handleFetchReports);
}
