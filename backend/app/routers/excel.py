from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..common import today
from ..db import get_db
from ..security import current_user
from ..services.excel_io import export_workbook, import_workbook

router = APIRouter(tags=["excel"], dependencies=[Depends(current_user)])

MAX_UPLOAD = 10 * 1024 * 1024


@router.post("/import/excel")
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "File too large")
    try:
        return import_workbook(db, data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:
        db.rollback()
        raise HTTPException(400, "Could not read this file. Please upload the .xlsx call tracker.")


@router.get("/export/excel")
def export_excel(db: Session = Depends(get_db)):
    return Response(
        export_workbook(db),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="call-tracker-{today().isoformat()}.xlsx"'},
    )
